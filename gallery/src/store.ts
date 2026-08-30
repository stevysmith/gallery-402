/**
 * One small external store shared by the UI, the ⌘K palette and the WebMCP
 * tools, so a tool call from an agent moves the same pixels a click would.
 */
import { useSyncExternalStore } from 'react'
import { getMuseum, getArtworks, requestDrip, getSettlements, askDocent as apiAskDocent, publishTour, BOX_OFFICE, type Museum, type Artwork, type Ticket, type Settlement, type CuratedTour } from './api'
import { decodePaymentRequiredHeader } from '@x402/core/http'
import { VisitorWallet, loadPolicy, savePolicy, PaymentDeclined, type SpendPolicy, type PaymentQuote, type PaymentReceipt, type PaymentEvent } from './wallet'

export type View = { screen: 'lobby' } | { screen: 'wing'; wing: string; index: number } | { screen: 'compare'; a: string; b: string }
/** A rectangle inside an artwork, in fractions of its width/height (0–1). */
export type Region = { x: number; y: number; w: number; h: number }
export type Stop = { id: string; artworkId: string; wing: string; title: string; note: string; spotlight?: Region }
export type Tour = { theme: string; stops: Stop[]; cursor: number; status: 'proposed' | 'active' | 'done'; curatedId?: string; savedUrl?: string }
export type Spotlight = { artworkId: string; region: Region | null; note: string }
export type Pointing = { artworkId: string; x: number; y: number; at: number }
export type LogKind = 'agent' | 'human' | 'pay' | 'ok' | 'info' | 'error'
export type LogEntry = { id: number; at: number; kind: LogKind; text: string; href?: string; undoId?: string; irreversible?: boolean }
/**
 * A point the visitor can return to. We snapshot the reversible slice of the
 * museum — where you are, the itinerary, the spotlight — because that is
 * genuinely undoable. Money is not in here, and that asymmetry is the point:
 * `spent` records what an action cost so the row can say so out loud.
 */
export type UndoPoint = { id: string; label: string; at: number; spent?: number; snapshot: { view: View; tour: Tour | null; spotlight: Spotlight | null; pointing: Pointing | null } }
export type Stub = Ticket & { txHash?: string; explorer?: string; at: number }

export type State = {
  museum: Museum | null
  loading: boolean
  error: string | null
  view: View
  tickets: Record<string, Stub>
  works: Record<string, Artwork[]>
  wallet: VisitorWallet | null
  balance: number | null
  policy: SpendPolicy
  receipts: PaymentReceipt[]
  log: LogEntry[]
  confirm: { quote: PaymentQuote; resolve: (ok: boolean) => void } | null
  webmcp: boolean
  busy: string | null
  settlements: Settlement[]
  settlementsTotal: number
  /** the docent layer: a shared itinerary both the visitor and their agent edit */
  tour: Tour | null
  spotlight: Spotlight | null
  pointing: Pointing | null
  undo: UndoPoint[]
  /** What the visitor did since the agent's last tool call — piggybacked on the next result (WebMCP can't push). */
  sinceAgent: string[]
}

const initial: State = {
  museum: null,
  loading: true,
  error: null,
  view: { screen: 'lobby' },
  tickets: {},
  works: {},
  wallet: null,
  balance: null,
  policy: loadPolicy(),
  receipts: [],
  log: [],
  confirm: null,
  webmcp: false,
  busy: null,
  settlements: [],
  settlementsTotal: 0,
  tour: null,
  spotlight: null,
  pointing: null,
  undo: [],
  sinceAgent: [],
}

let state: State = initial
const listeners = new Set<() => void>()
const get = () => state
const set = (patch: Partial<State> | ((s: State) => Partial<State>)) => {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
export const useMuseum = () => useSyncExternalStore(subscribe, get, get)

let logId = 0
export function log(kind: LogKind, text: string, href?: string, meta?: { undoId?: string; irreversible?: boolean }) {
  set((s) => ({ log: [...s.log.slice(-79), { id: ++logId, at: Date.now(), kind, text, href, ...meta }] }))
  // human actions are queued for the agent's next tool result
  if (kind === 'human') set((s) => ({ sinceAgent: [...s.sinceAgent.slice(-7), text] }))
}
/**
 * Give the newest log line an undo point. Composed actions (a tour step walks
 * to an artwork) log from the inner call but own their undo point in the outer
 * one; this puts the affordance on the line the visitor actually reads.
 */
export function attachUndo(undoId: string) {
  if (!undoId) return
  set((s) => {
    const log = [...s.log]
    for (let i = log.length - 1; i >= 0; i--) {
      if (!log[i].undoId && !log[i].irreversible && log[i].kind !== 'error') {
        log[i] = { ...log[i], undoId }
        break
      }
    }
    return { log }
  })
}

/** Drain the queue of things the visitor did since the agent last called a tool. */
export function drainSinceAgent(): string[] {
  const items = state.sinceAgent
  if (items.length) set({ sinceAgent: [] })
  return items
}

const persist = () => {
  try {
    localStorage.setItem('g402.tickets', JSON.stringify(state.tickets))
    localStorage.setItem('g402.receipts', JSON.stringify(state.receipts))
    if (state.tour) localStorage.setItem('g402.tour', JSON.stringify(state.tour))
    else localStorage.removeItem('g402.tour')
  } catch {}
}
const restore = () => {
  try {
    const t = JSON.parse(localStorage.getItem('g402.tickets') ?? '{}') as Record<string, Stub>
    const valid = Object.fromEntries(Object.entries(t).filter(([, s]) => new Date(s.expiresAt).getTime() > Date.now()))
    const r = JSON.parse(localStorage.getItem('g402.receipts') ?? '[]') as PaymentReceipt[]
    set({ tickets: valid, receipts: r })
    const tour = JSON.parse(localStorage.getItem('g402.tour') ?? 'null') as Tour | null
    if (tour && tour.stops?.length) set({ tour })
  } catch {}
}

// ─── undo ─────────────────────────────────────────────────────────────────

let undoSeq = 0
/**
 * One undo point per action the visitor would name. Actions compose —
 * `start_tour` walks to stop 1, which shows an artwork — so an outer action
 * suppresses the inner ones rather than leaving three points to click through.
 */
let suppressUndo = false
async function asOneStep<T>(fn: () => Promise<T>): Promise<T> {
  suppressUndo = true
  try {
    return await fn()
  } finally {
    suppressUndo = false
  }
}

/**
 * Mark a point to come back to, before an action changes the museum.
 * `spent` is what the action costs the visitor — recorded, never refunded.
 */
export function pushUndo(label: string, spent?: number): string {
  if (suppressUndo) return ''
  const id = `u${++undoSeq}`
  const point: UndoPoint = {
    id,
    label,
    at: Date.now(),
    spent,
    snapshot: { view: state.view, tour: state.tour, spotlight: state.spotlight, pointing: state.pointing },
  }
  set((s) => ({ undo: [...s.undo.slice(-24), point] }))
  return id
}

export const undoPoint = (id: string) => (id ? state.undo.find((u) => u.id === id) ?? null : null)
export const lastUndo = () => state.undo[state.undo.length - 1] ?? null

/**
 * Return the museum to the state before `id` — and everything after it, the way
 * undo works in any document. Tickets bought along the way stay bought.
 */
export function undoTo(id: string, via: 'agent' | 'human' = 'human') {
  const i = state.undo.findIndex((u) => u.id === id)
  if (i < 0) throw new Error('That step is no longer undoable.')
  const point = state.undo[i]
  const dropped = state.undo.slice(i)
  const spent = dropped.reduce((a, u) => a + (u.spent ?? 0), 0)
  set({ ...point.snapshot, undo: state.undo.slice(0, i) })
  persist()
  log(via, `${via === 'agent' ? 'Agent' : 'You'} undid “${point.label}”.${spent > 0 ? ` The $${spent.toFixed(2)} stays spent — tickets don't come back.` : ''}`)
  return { undid: point.label, steps: dropped.length, moneyKept: spent > 0 ? `$${spent.toFixed(2)}` : null }
}

// ─── lookups ─────────────────────────────────────────────────────────────

export const wingOf = (id: string) => state.museum?.wings.find((w) => w.id === id) ?? null
export const ticketFor = (wing: string): Stub | null => {
  const now = Date.now()
  const ok = (s?: Stub) => (s && new Date(s.expiresAt).getTime() > now ? s : null)
  return ok(state.tickets['*']) ?? ok(state.tickets[wing]) ?? null
}
export const hasTicket = (wing: string) => !!ticketFor(wing)
/** Change what's on the wall. Leaving an artwork clears its spotlight and the visitor's pointer. */
function showView(view: View) {
  const before = currentArtwork()?.id
  set({ view })
  const after = currentArtwork()?.id
  if (before !== after) set({ spotlight: null, pointing: null })
}

export const currentArtwork = (): Artwork | null => {
  const v = state.view
  if (v.screen !== 'wing') return null
  return state.works[v.wing]?.[v.index] ?? null
}
export function findArtwork(query: string): { wing: string; index: number; art: Artwork } | null {
  const q = query.trim().toLowerCase()
  for (const [wing, list] of Object.entries(state.works)) {
    const i = list.findIndex((a) => a.id === q || a.title.toLowerCase() === q)
    if (i >= 0) return { wing, index: i, art: list[i] }
  }
  for (const [wing, list] of Object.entries(state.works)) {
    const i = list.findIndex((a) => a.title.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q))
    if (i >= 0) return { wing, index: i, art: list[i] }
  }
  return null
}
/** Where a title lives even before its wing is loaded (from the public teasers). */
export function locateTeaser(query: string): { wing: string; id: string; title: string } | null {
  const q = query.trim().toLowerCase()
  for (const w of state.museum?.wings ?? []) {
    const t = w.teasers.find((t) => t.id === q || t.title.toLowerCase().includes(q))
    if (t) return { wing: w.id, id: t.id, title: t.title }
  }
  return null
}

// ─── actions ─────────────────────────────────────────────────────────────

export async function init() {
  if (state.wallet) return
  const wallet = new VisitorWallet()
  set({ wallet })
  restore()
  try {
    const museum = await getMuseum()
    set({ museum, loading: false })
    log('info', `${museum.name} is open. Tickets settle in USDC on ${museum.network === 'eip155:84532' ? 'Base Sepolia' : museum.network}.`)
  } catch (e: any) {
    set({ loading: false, error: `The box office at ${BOX_OFFICE} isn't answering (${e?.message ?? e}).` })
  }
  await refreshBalance().catch(() => {})
  ensureFunds().catch(() => {})
}

export async function refreshBalance() {
  const w = state.wallet
  if (!w) return
  const { usdc } = await w.balance()
  set({ balance: usdc })
  return usdc
}

export function setPolicy(patch: Partial<SpendPolicy>) {
  const policy = { ...state.policy, ...patch }
  savePolicy(policy)
  set({ policy })
  log('human', policy.askEveryTime ? 'Policy: ask me before every payment.' : `Policy: auto-approve up to $${policy.autoApproveUpToUsd.toFixed(2)} per ticket.`)
}

export function resolveConfirm(ok: boolean) {
  state.confirm?.resolve(ok)
  set({ confirm: null })
}

const openConfirm = (quote: PaymentQuote) => new Promise<boolean>((resolve) => set({ confirm: { quote, resolve } }))

const onPaymentEvent = (e: PaymentEvent) => {
  switch (e.type) {
    case 'quote':
      log('pay', `Box office quotes $${e.quote.amountUsd.toFixed(2)} — ${e.quote.description}`)
      break
    case 'policy':
      log(e.decision === 'auto' ? 'ok' : 'human', e.decision === 'auto' ? `Within your policy (≤ $${state.policy.autoApproveUpToUsd.toFixed(2)}) — paying without asking` : 'Outside your policy — asking you first')
      break
    case 'declined':
      log('human', 'You declined the payment.')
      break
    case 'signed':
      log('pay', 'Signed a USDC transfer authorization (EIP-3009). No gas, no popup.')
      break
    case 'settled':
      log('ok', `Settled on-chain · ${e.receipt.txHash.slice(0, 10)}…`, e.receipt.explorer)
      break
    case 'error':
      log('error', e.message)
      break
  }
}

export async function buyTicket(id: string, via: 'agent' | 'human' = 'human'): Promise<Stub> {
  const m = state.museum
  if (!m) throw new Error('The box office is not reachable right now.')
  if (!state.wallet) throw new Error('Wallet not ready.')
  const isPass = id === m.dayPass.id
  const wing = isPass ? null : wingOf(id)
  if (!isPass && !wing) throw new Error(`Unknown wing "${id}". Wings: ${m.wings.map((w) => w.id).join(', ')}, or "${m.dayPass.id}".`)
  const name = isPass ? m.dayPass.name : wing!.name
  const existing = isPass ? state.tickets['*'] : ticketFor(id)
  if (existing && (isPass ? existing.wing === '*' : true)) {
    log('info', `You already hold a ticket for the ${name}.`)
    return existing
  }
  set({ busy: `Buying a ticket: ${name}` })
  log(via, `${via === 'agent' ? 'Agent' : 'You'} asked the box office for a ticket: ${name}`)
  try {
    const url = `${BOX_OFFICE}/tickets/${id}`
    let { response, receipt } = await state.wallet.payFetch(url, {}, { policy: state.policy, confirm: openConfirm, onEvent: onPaymentEvent })
    // An empty wallet is the one failure a first-time visitor will always hit.
    // Top up and try once more rather than handing them an error.
    if (response.status === 402 && !autoFunded) {
      set({ busy: 'Topping up the wallet' })
      if (await ensureFunds()) {
        log('info', 'Wallet was empty — topped up and retrying.')
        ;({ response, receipt } = await state.wallet.payFetch(url, {}, { policy: state.policy, confirm: openConfirm, onEvent: onPaymentEvent }))
      }
    }
    if (response.status === 402) {
      const hdr = response.headers.get('PAYMENT-REQUIRED')
      let reason = ''
      try {
        reason = hdr ? decodePaymentRequiredHeader(hdr).error ?? '' : ''
      } catch {}
      const bal = state.balance ?? 0
      throw new Error(`Payment did not settle${reason ? ` (${reason})` : ''}. Wallet balance is $${bal.toFixed(2)} USDC${bal < 0.02 ? ' — call fund_wallet to get testnet USDC first' : ''}.`)
    }
    if (!response.ok) throw new Error(`Box office error ${response.status}`)
    const t = (await response.json()) as Ticket
    const stub: Stub = { ...t, txHash: receipt?.txHash, explorer: receipt?.explorer, at: Date.now() }
    set((s) => ({ tickets: { ...s.tickets, [t.wing]: stub }, receipts: receipt ? [receipt, ...s.receipts] : s.receipts }))
    persist()
    log('ok', `Ticket issued: ${t.wingName} · admit one · valid until ${new Date(t.expiresAt).toLocaleTimeString()}`, undefined, { irreversible: true })
    refreshBalance().catch(() => {})
    loadSettlements()
    return stub
  } catch (e: any) {
    if (e instanceof PaymentDeclined) throw new Error('The visitor declined the payment.')
    log('error', e?.message ?? String(e))
    throw e
  } finally {
    set({ busy: null })
  }
}

async function loadWing(wing: string): Promise<Artwork[]> {
  if (state.works[wing]) return state.works[wing]
  const t = ticketFor(wing)
  const w = wingOf(wing)
  if (!t) throw new Error(`No ticket for the ${w?.name ?? wing} (${w?.price ?? ''}). buy_ticket("${wing}") first.`)
  try {
    const { artworks } = await getArtworks(wing, t.ticket)
    set((s) => ({ works: { ...s.works, [wing]: artworks } }))
    return artworks
  } catch (e: any) {
    if (e?.message === 'ticket_required') {
      // The box office no longer honours this ticket (expired, or the box office was
      // redeployed with a new secret). Drop it so the page and the agent agree.
      set((s) => {
        const tickets = { ...s.tickets }
        delete tickets[t.wing]
        return { tickets }
      })
      persist()
      log('error', `The box office rejected your ${t.wingName} ticket (expired or reissued) — it has been removed.`)
      throw new Error(`Your ticket for the ${w?.name ?? wing} was rejected by the box office (expired or reissued) and has been dropped. buy_ticket("${wing}") again.`)
    }
    throw e
  }
}

export async function enterWing(id: string, via: 'agent' | 'human' = 'human') {
  const w = wingOf(id)
  if (!w) throw new Error(`Unknown wing "${id}".`)
  if (!hasTicket(id)) throw new Error(`No ticket for the ${w.name} (${w.price}). Call buy_ticket with wing "${id}" first, then enter_wing.`)
  const works = await loadWing(id)
  const u = pushUndo(`entered the ${w.name}`)
  showView({ screen: 'wing', wing: id, index: 0 })
  log(via, `${via === 'agent' ? 'Agent' : 'You'} entered the ${w.name}.`, undefined, { undoId: u })
  return works
}

export async function viewArtwork(query: string, via: 'agent' | 'human' = 'human') {
  let hit = findArtwork(query)
  if (!hit) {
    const loc = locateTeaser(query)
    if (!loc) throw new Error(`No artwork matching "${query}". Use list_wings to see titles.`)
    const w = wingOf(loc.wing)!
    if (!hasTicket(loc.wing)) throw new Error(`"${loc.title}" hangs in the ${w.name}, which needs a ticket (${w.price}). Call buy_ticket with wing "${loc.wing}" first.`)
    await loadWing(loc.wing)
    hit = findArtwork(loc.id)!
  }
  const u = pushUndo(`went to “${hit.art.title}”`)
  showView({ screen: 'wing', wing: hit.wing, index: hit.index })
  log(via, `${via === 'agent' ? 'Agent' : 'You'} stopped at “${hit.art.title}”.`, undefined, { undoId: u })
  return hit.art
}

export function walk(direction: 'next' | 'previous') {
  const v = state.view
  if (v.screen !== 'wing') throw new Error(v.screen === 'compare' ? 'You are comparing two works. Use view_artwork or enter_wing to return to a wall.' : 'You are in the lobby. enter_wing first.')
  const list = state.works[v.wing] ?? []
  const index = direction === 'next' ? v.index + 1 : v.index - 1
  if (index < 0 || index >= list.length) return { atEnd: true, artwork: list[v.index] }
  const u = pushUndo(`walked to “${list[index].title}”`)
  showView({ ...v, index })
  log('human', `Moved to “${list[index].title}”.`, undefined, { undoId: u })
  return { atEnd: false, artwork: list[index] }
}

export function goLobby() {
  if (state.view.screen !== 'lobby') pushUndo('returned to the lobby')
  showView({ screen: 'lobby' })
}

// ─── the docent layer ─────────────────────────────────────────────────────

const WING_ORDER = ['impressionists', 'van-gogh', 'ukiyo-e', 'dutch-cabinet']

/** Resolve an artwork reference (id, title or artist) against the public catalog. */
export function resolveArtwork(query: string): { wing: string; id: string; title: string } | null {
  const q = query.trim().toLowerCase()
  if (!q) return null
  for (const w of state.museum?.wings ?? []) {
    const t = w.teasers.find((t) => t.id === q || t.title.toLowerCase() === q)
    if (t) return { wing: w.id, id: t.id, title: t.title }
  }
  return locateTeaser(q)
}

/** What starting a tour would cost from where the visitor stands now. */
export function tourCost(tour: Tour | null = state.tour) {
  const m = state.museum
  if (!m || !tour) return { needed: [] as string[], buy: [] as string[], cost: 0, label: '' }
  const needed = [...new Set(tour.stops.map((s) => s.wing))].filter((w) => !hasTicket(w))
  if (!needed.length) return { needed, buy: [], cost: 0, label: 'all doors already open' }
  const price = (id: string) => parseFloat((wingOf(id)?.price ?? '$0').replace('$', ''))
  const sum = needed.reduce((a, w) => a + price(w), 0)
  const pass = parseFloat(m.dayPass.price.replace('$', ''))
  if (needed.length > 1 && pass <= sum) {
    const how = pass < sum ? `cheaper than ${needed.length} tickets at $${sum.toFixed(2)}` : `same price as ${needed.length} tickets, and covers every wing`
    return { needed, buy: [m.dayPass.id], cost: pass, label: `day pass ${m.dayPass.price} (${how})` }
  }
  return { needed, buy: needed, cost: sum, label: `${needed.length} ticket${needed.length === 1 ? '' : 's'}, $${sum.toFixed(2)}` }
}

/** The museum's own tours, taken with one click — no model involved. */
export function curatedTours(): CuratedTour[] {
  return state.museum?.tours ?? []
}

export function takeTour(id: string, via: 'agent' | 'human' = 'human') {
  const t = curatedTours().find((x) => x.id === id)
  if (!t) throw new Error(`Unknown tour "${id}". Available: ${curatedTours().map((x) => x.id).join(', ')}.`)
  const r = planTour(t.theme, t.stops, via)
  set((s) => ({ tour: s.tour ? { ...s.tour, curatedId: t.id } : s.tour }))
  persist()
  return r
}

/** Publish the tour as a keepsake page on Stacktree and remember the link. */
export async function saveTour(via: 'agent' | 'human' = 'human') {
  const t = state.tour
  if (!t) throw new Error('No tour to save. plan_tour or take_tour first.')
  if (t.savedUrl) return { url: t.savedUrl, alreadySaved: true }
  set({ busy: 'Publishing your tour' })
  log(via, `${via === 'agent' ? 'Agent' : 'You'} published the tour “${t.theme}”.`)
  try {
    // Inline every image so the page is self-contained and outlives this session.
    const images: Record<string, string> = {}
    await Promise.all(
      t.stops.map(async (stop) => {
        const file = teaserFile(stop.artworkId)
        const src = file ? teaserLookup(file) : undefined
        const data = src ? await toDataUri(src) : undefined
        if (data) images[stop.artworkId] = data
      }),
    )
    const { url } = await publishTour(renderTourPage(t, images), t.theme)
    set((s) => ({ tour: s.tour ? { ...s.tour, savedUrl: url } : s.tour }))
    persist()
    log('ok', 'Tour published — the link is yours to keep (24 hours).', url, { irreversible: true })
    return { url }
  } catch (e: any) {
    log('error', `Could not publish: ${e?.message ?? e}`)
    throw e
  } finally {
    set({ busy: null })
  }
}

/** Self-contained HTML for the keepsake page: images inlined, no scripts. */
function renderTourPage(t: Tour, images: Record<string, string>): string {
  const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const paid = state.receipts.reduce((a, r) => a + r.amountUsd, 0)
  const stops = t.stops
    .map((stop, i) => {
      const art = findArtwork(stop.artworkId)?.art
      const img = images[stop.artworkId]
      return `
      <figure class="stop">
        <span class="n">${i + 1}</span>
        ${img ? `<img src="${img}" alt="${esc(art?.title ?? stop.title)}" />` : ''}
        <figcaption>
          <h2>${esc(art?.title ?? stop.title)}</h2>
          <p class="by">${esc(art?.artist ?? artistOf(stop.artworkId) ?? '')}${art?.date ? ` · ${esc(art.date)}` : ''}</p>
          ${stop.note ? `<p class="note">${esc(stop.note)}</p>` : ''}
          ${art ? `<p class="credit">${esc(art.museum)}. ${esc(art.credit)}. Public domain. <a href="${esc(art.sourceUrl)}">Source</a></p>` : ''}
        </figcaption>
      </figure>`
    })
    .join('')
  const receipts = state.receipts
    .slice(0, 6)
    .map((r) => `<li><span>$${r.amountUsd.toFixed(2)}</span> ${esc(r.description.replace(/^Gallery 402 — /, ''))} <a href="${esc(r.explorer)}">${esc(r.txHash.slice(0, 10))}…</a></li>`)
    .join('')
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(t.theme)} — a tour of Gallery 402</title>
<meta name="description" content="A guided tour of Gallery 402: ${esc(t.theme)}.">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=IBM+Plex+Sans:wght@400;500&family=IBM+Plex+Mono:wght@400&display=swap" rel="stylesheet">
<style>
:root{--wall:#17302a;--paper:#f4efe4;--ink:#17140f;--ink2:#5a5446;--brass:#c8a45d}
*{box-sizing:border-box}body{margin:0;background:var(--wall);color:var(--paper);font:16px/1.6 'IBM Plex Sans',system-ui,sans-serif}
header{max-width:760px;margin:0 auto;padding:64px 24px 32px}
.eyebrow{font-size:11.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--brass);margin:0 0 10px}
h1{font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:clamp(34px,6vw,56px);line-height:1.05;margin:0 0 12px}
header p{color:rgba(244,239,228,.72);margin:0}
main{max-width:760px;margin:0 auto;padding:0 24px 40px;display:flex;flex-direction:column;gap:40px}
.stop{margin:0;background:var(--paper);color:var(--ink);border-radius:3px;overflow:hidden;position:relative;box-shadow:0 24px 50px -30px rgba(0,0,0,.7)}
.stop .n{position:absolute;top:12px;left:12px;z-index:1;font-family:'IBM Plex Mono',monospace;font-size:12px;background:var(--brass);color:var(--ink);width:26px;height:26px;border-radius:50%;display:grid;place-items:center}
.stop img{display:block;width:100%;max-height:520px;object-fit:contain;background:#0a0806}
figcaption{padding:20px 22px 22px}
h2{font-family:'Instrument Serif',Georgia,serif;font-style:italic;font-weight:400;font-size:26px;margin:0 0 2px}
.by{margin:0 0 12px;font-weight:500}
.note{margin:0 0 14px}
.credit,.credit a{font-size:11.5px;color:var(--ink2)}
footer{max-width:760px;margin:0 auto;padding:28px 24px 72px;border-top:1px solid rgba(244,239,228,.25);font-size:13.5px;color:rgba(244,239,228,.72)}
footer a{color:var(--brass)}
footer ul{list-style:none;padding:0;margin:10px 0 0;display:flex;flex-direction:column;gap:4px;font-family:'IBM Plex Mono',monospace;font-size:12px}
footer li span{color:var(--paper)}
</style></head><body>
<header>
  <p class="eyebrow">A tour of Gallery 402</p>
  <h1>${esc(t.theme)}</h1>
  <p>${t.stops.length} stop${t.stops.length === 1 ? '' : 's'}${paid > 0 ? ` · admission $${paid.toFixed(2)}, paid over HTTP 402` : ''}</p>
</header>
<main>${stops}</main>
<footer>
  <p>Every work here is public domain, from museum open-access collections. The tour was walked at <a href="${esc(location.origin)}">Gallery 402</a>, a museum whose box office is a set of WebMCP tools and whose admission is paid in USDC over x402.</p>
  ${receipts ? `<p style="margin-top:14px">Admission paid:</p><ul>${receipts}</ul>` : ''}
</footer>
</body></html>`
}

/** Artist for any artwork, from the public manifest. */
function artistOf(artworkId: string): string | undefined {
  for (const w of state.museum?.wings ?? []) {
    const t = w.teasers.find((x) => x.id === artworkId)
    if (t) return t.artist
  }
  return undefined
}

/** Resolves a teaser file name to its bundled image URL (set by the app at startup). */
let teaserLookup: (file: string) => string | undefined = () => undefined
export const setTeaserLookup = (fn: (file: string) => string | undefined) => {
  teaserLookup = fn
}

/** The teaser file for any artwork in the collection — from the public manifest, so
 *  it works for rooms the visitor never opened. */
function teaserFile(artworkId: string): string | undefined {
  for (const w of state.museum?.wings ?? []) {
    const t = w.teasers.find((x) => x.id === artworkId)
    if (t) return t.teaser.replace('teasers/', '')
  }
  return undefined
}

/** Inline an image as a data URI so the published page stands alone. */
async function toDataUri(url: string): Promise<string | undefined> {
  if (url.startsWith('data:')) return url
  try {
    const blob = await fetch(url).then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(String(fr.result))
      fr.onerror = () => reject(fr.error)
      fr.readAsDataURL(blob)
    })
  } catch {
    return undefined
  }
}

export function planTour(theme: string, wanted: { artwork: string; note?: string; spotlight?: Region }[], via: 'agent' | 'human' = 'agent') {
  if (!state.museum) throw new Error('The box office is not reachable right now.')
  if (!wanted.length) throw new Error('A tour needs at least one stop. Use list_wings for titles.')
  const stops: Stop[] = []
  const unknown: string[] = []
  for (const w of wanted) {
    const hit = resolveArtwork(w.artwork)
    if (!hit) {
      unknown.push(w.artwork)
      continue
    }
    if (stops.some((s) => s.artworkId === hit.id)) continue
    stops.push({ id: `${hit.id}-${stops.length}`, artworkId: hit.id, wing: hit.wing, title: hit.title, note: (w.note ?? '').trim(), spotlight: validRegion(w.spotlight) })
  }
  if (!stops.length) throw new Error(`None of those titles are in the collection: ${unknown.join(', ')}. Use list_wings.`)
  // group stops by wing in gallery order so the visitor isn't marched back and forth
  stops.sort((a, b) => WING_ORDER.indexOf(a.wing) - WING_ORDER.indexOf(b.wing))
  const tour: Tour = { theme: theme.trim() || 'A tour', stops, cursor: -1, status: 'proposed' }
  const u = pushUndo(`proposed “${tour.theme}”`)
  set({ tour })
  persist()
  const cost = tourCost(tour)
  log(via, `${via === 'agent' ? 'Agent' : 'You'} proposed a tour — “${tour.theme}”, ${stops.length} stop${stops.length === 1 ? '' : 's'}${cost.needed.length ? ` · needs ${cost.label}` : ''}.`, undefined, { undoId: u })
  return { tour, cost, unknown }
}

export async function startTour(via: 'agent' | 'human' = 'agent'): Promise<Record<string, unknown>> {
  const tour = state.tour
  if (!tour) throw new Error('No tour proposed. Call plan_tour first.')
  const cost = tourCost(tour)
  const u = pushUndo(`started “${tour.theme}”`, cost.cost)
  for (const id of cost.buy) await buyTicket(id, via)
  set({ tour: { ...tour, status: 'active', cursor: -1 } })
  persist()
  log(via, `Tour started — “${tour.theme}”.`, undefined, { undoId: u })
  return asOneStep(() => tourStep('next', via))
}

export async function tourStep(direction: 'next' | 'previous' = 'next', via: 'agent' | 'human' = 'agent'): Promise<Record<string, unknown>> {
  const tour = state.tour
  if (!tour) throw new Error('No tour in progress. plan_tour, then start_tour.')
  if (tour.status === 'proposed') return startTour(via)
  const cursor = direction === 'next' ? tour.cursor + 1 : tour.cursor - 1
  if (cursor >= tour.stops.length) {
    set({ tour: { ...tour, status: 'done' } })
    persist()
    log(via, `Tour finished — “${tour.theme}”.`)
    return { done: true, theme: tour.theme, stops: tour.stops.length }
  }
  if (cursor < 0) return { done: false, atStart: true, stop: tour.stops[0] }
  const stop = tour.stops[cursor]
  if (!hasTicket(stop.wing)) throw new Error(`The ${wingOf(stop.wing)?.name} needs a ticket for “${stop.title}”. buy_ticket("${stop.wing}") and step again.`)
  const u = pushUndo(`stepped to “${stop.title}”`)
  const art = await asOneStep(() => viewArtwork(stop.artworkId, via))
  attachUndo(u)
  set({ tour: { ...tour, cursor, status: 'active' }, spotlight: stop.note || stop.spotlight ? { artworkId: art.id, region: stop.spotlight ?? null, note: stop.note } : null })
  persist()
  return { done: false, stop: cursor + 1, of: tour.stops.length, showing: art.title, artist: art.artist, note: stop.note || art.note, spotlight: stop.spotlight ?? null, next: tour.stops[cursor + 1]?.title ?? null }
}

export function endTour(via: 'agent' | 'human' = 'human') {
  if (state.tour) {
    const u = pushUndo(`ended “${state.tour.theme}”`)
    log(via, `Tour ended — “${state.tour.theme}”.`, undefined, { undoId: u })
  }
  set({ tour: null, spotlight: null })
  persist()
}

/** Visitor-side edits to the itinerary. The agent sees them through look_around. */
export function moveStop(index: number, direction: 'up' | 'down') {
  const t = state.tour
  if (!t) return
  const j = direction === 'up' ? index - 1 : index + 1
  if (j < 0 || j >= t.stops.length) return
  pushUndo(`reordered “${t.stops[index].title}”`)
  const stops = [...t.stops]
  ;[stops[index], stops[j]] = [stops[j], stops[index]]
  let cursor = t.cursor
  if (cursor === index) cursor = j
  else if (cursor === j) cursor = index
  set({ tour: { ...t, stops, cursor } })
  persist()
}
export function removeStop(index: number) {
  const t = state.tour
  if (!t) return
  const stops = t.stops.filter((_, i) => i !== index)
  const cursor = index < t.cursor ? t.cursor - 1 : index === t.cursor ? t.cursor - 1 : t.cursor
  const u = pushUndo(`dropped “${t.stops[index].title}”`)
  log('human', `You dropped “${t.stops[index].title}” from the tour.`, undefined, { undoId: u })
  if (!stops.length) return endTour('human')
  set({ tour: { ...t, stops, cursor } })
  persist()
}

function validRegion(r?: Region): Region | undefined {
  if (!r) return undefined
  const n = (v: any) => Math.min(1, Math.max(0, Number(v)))
  const x = n(r.x), y = n(r.y), w = Math.min(1 - x, Math.max(0.02, n(r.w))), h = Math.min(1 - y, Math.max(0.02, n(r.h)))
  return { x, y, w, h }
}

/** Point the visitor at a detail: zoom in on a region and say why. Region omitted → the whole work, note only. */
export async function spotlight(opts: { artwork?: string; region?: Region; note?: string }, via: 'agent' | 'human' = 'agent') {
  let art = currentArtwork()
  if (opts.artwork) {
    const cur = art
    const hit = resolveArtwork(opts.artwork)
    if (!hit) throw new Error(`No artwork matching "${opts.artwork}".`)
    if (!cur || cur.id !== hit.id) art = await asOneStep(() => viewArtwork(hit.id, via))
  }
  if (!art) throw new Error('Nothing is on the wall. enter_wing or view_artwork first.')
  const region = validRegion(opts.region) ?? null
  const note = (opts.note ?? '').trim()
  const u = pushUndo(region || note ? `spotlit “${art.title}”` : 'cleared the spotlight')
  set({ spotlight: region || note ? { artworkId: art.id, region, note } : null, pointing: null })
  log(
    via,
    region ? `${via === 'agent' ? 'Agent' : 'You'} spotlit a detail of “${art.title}”${note ? ` — ${note.slice(0, 80)}${note.length > 80 ? '…' : ''}` : ''}.` : `Spotlight cleared on “${art.title}”.`,
    undefined,
    { undoId: u },
  )
  return { artwork: art.title, region, note }
}

export function clearSpotlight() {
  set({ spotlight: null })
}

/** The visitor clicked a spot on the painting — becomes context for the agent. */
export function setPointing(x: number, y: number) {
  const art = currentArtwork()
  if (!art) return
  set({ pointing: { artworkId: art.id, x, y, at: Date.now() } })
  const where = `(${Math.round(x * 100)}%, ${Math.round(y * 100)}%) of “${art.title}”`
  log('human', docentEnabled() ? `You pointed at ${where}.` : state.webmcp ? `You pointed at ${where} — ask your agent “what's that?”` : `You pointed at ${where} — no agent is listening yet.`)
}

export const docentEnabled = () => state.museum?.endpoints?.docent === 'enabled'

/** Ask the museum's own docent about the spot the visitor pointed at. */
export async function askDocent(question?: string, via: 'agent' | 'human' = 'human') {
  const art = currentArtwork()
  const p = state.pointing
  const v = state.view
  if (!art || v.screen !== 'wing') throw new Error('Stand in front of a painting first.')
  if (!p || p.artworkId !== art.id) throw new Error('Point at a spot on the painting first (click it).')
  if (!docentEnabled()) throw new Error('The docent is not on duty — the box office has no ANTHROPIC_API_KEY.')
  const ticket = ticketFor(v.wing)
  if (!ticket) throw new Error('Ticket required.')
  set({ busy: 'Asking the docent' })
  log(via, `${via === 'agent' ? 'Agent' : 'You'} asked the docent what's at ${Math.round(p.x * 100)}%, ${Math.round(p.y * 100)}% of “${art.title}”${question ? ` — “${question}”` : ''}.`)
  try {
    const r = await apiAskDocent({ artworkId: art.id, x: p.x, y: p.y, question, ticket: ticket.ticket })
    // keep the pin: follow-up questions refer to the same spot
    const u = pushUndo(`asked the docent about “${art.title}”`)
    set({ spotlight: { artworkId: art.id, region: r.region, note: r.answer } })
    log('ok', `Docent: ${r.answer.slice(0, 120)}${r.answer.length > 120 ? '…' : ''}`, undefined, { undoId: u })
    return { artwork: art.title, answer: r.answer, region: r.region }
  } catch (e: any) {
    log('error', `Docent: ${e?.message ?? e}`)
    throw e
  } finally {
    set({ busy: null })
  }
}

export async function compareWorks(a: string, b: string, via: 'agent' | 'human' = 'agent') {
  const ha = resolveArtwork(a), hb = resolveArtwork(b)
  if (!ha || !hb) throw new Error(`Couldn't find ${!ha ? `"${a}"` : `"${b}"`}. Use list_wings for titles.`)
  for (const h of [ha, hb]) {
    const w = wingOf(h.wing)!
    if (!hasTicket(h.wing)) throw new Error(`“${h.title}” hangs in the ${w.name}, which needs a ticket (${w.price}). buy_ticket("${h.wing}") first.`)
    await loadWing(h.wing)
  }
  const u = pushUndo(`compared “${ha.title}” and “${hb.title}”`)
  showView({ screen: 'compare', a: ha.id, b: hb.id })
  set({ spotlight: null, pointing: null })
  log(via, `${via === 'agent' ? 'Agent' : 'You'} hung “${ha.title}” beside “${hb.title}”.`, undefined, { undoId: u })
  const fa = findArtwork(ha.id)!.art, fb = findArtwork(hb.id)!.art
  return { a: { title: fa.title, artist: fa.artist, date: fa.date, note: fa.note }, b: { title: fb.title, artist: fb.artist, date: fb.date, note: fb.note } }
}

/** True once we've auto-topped-up this session, so an empty treasury isn't hammered. */
let autoFunded = false

/** On arrival, quietly put a few cents in the wallet so the first click can never dead-end. */
export async function ensureFunds(): Promise<boolean> {
  if (autoFunded || !state.wallet) return false
  if ((state.balance ?? 0) >= 0.02) return false
  if (!state.museum?.endpoints?.faucet) return false
  autoFunded = true
  const r = await requestDrip(state.wallet.address).catch(() => null)
  if (r?.ok) {
    log('ok', `The museum staked you ${r.amount} test USDC so you can try the box office.`, r.explorer !== '#mock' ? r.explorer : undefined)
    await new Promise((res) => setTimeout(res, r.txHash?.startsWith('0xmock') ? 0 : 2500))
    await refreshBalance().catch(() => {})
    return true
  }
  return false
}

export async function fundWallet(via: 'agent' | 'human' = 'human') {
  const w = state.wallet
  if (!w) throw new Error('Wallet not ready.')
  set({ busy: 'Asking the testnet faucet for USDC' })
  log(via, `${via === 'agent' ? 'Agent' : 'You'} asked the faucet to top up the wallet.`)
  try {
    const r = await requestDrip(w.address)
    if (r.ok) {
      log('ok', `Faucet sent ${r.amount} USDC · ${r.txHash?.slice(0, 10)}…`, r.explorer)
      // give the chain a moment before re-reading the balance
      await new Promise((res) => setTimeout(res, 2500))
      await refreshBalance().catch(() => {})
    } else {
      log('error', `Faucet: ${r.error}${r.hint ? ` — ${r.hint}` : ''}`)
    }
    return r
  } finally {
    set({ busy: null })
  }
}

export function resetVisitor() {
  VisitorWallet.reset()
  try {
    localStorage.removeItem('g402.tickets')
    localStorage.removeItem('g402.receipts')
  } catch {}
  location.reload()
}

export async function loadSettlements() {
  try {
    const r = await getSettlements()
    set({ settlements: r.settlements, settlementsTotal: r.total })
    return r
  } catch {
    return null
  }
}

export const setWebmcp = (webmcp: boolean) => set({ webmcp })
export { get as getState }

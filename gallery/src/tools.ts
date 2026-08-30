/**
 * The tool catalog. ONE list drives both the ⌘K palette (humans) and
 * WebMCP registration (agents in ChatGPT / Chrome). Agents can buy tickets
 * and walk the rooms; they cannot change the visitor's spending policy —
 * that stays a human control in the wallet panel.
 */
import { useMemo } from 'react'
import type { AgentKToolDef } from '@stevysmith/agentk'
import * as S from './store'
import { useMuseum } from './store'
import { short } from './wallet'
import { BOX_OFFICE } from './api'

export const WING_IDS = ['impressionists', 'van-gogh', 'ukiyo-e', 'dutch-cabinet'] as const

const STOPS_SCHEMA = {
  type: 'array',
  description: 'Ordered {artwork, note, spotlight?}. spotlight is {x,y,w,h} as fractions of the image. Titles from list_artworks.',
  items: {
    type: 'object',
    properties: {
      artwork: { type: 'string', description: 'Artwork title or id from list_artworks.' },
      note: { type: 'string', description: 'Your docent note for this stop.' },
      spotlight: {
        type: 'object',
        description: 'Optional detail to zoom into, as fractions of the image.',
        properties: { x: { type: 'number' }, y: { type: 'number' }, w: { type: 'number' }, h: { type: 'number' } },
      },
    },
    required: ['artwork'],
  },
} as any

/** The full catalog. `useTools()` narrows it to what makes sense right now. */
export const TOOLS: AgentKToolDef[] = [
  {
    name: 'list_wings',
    annotations: { readOnlyHint: true },
    label: 'List wings & prices',
    description: 'List the museum wings, ticket prices, what hangs in each, and which you already hold tickets for.',
    keywords: ['rooms', 'prices', 'tickets', 'what is here'],
  },
  {
    name: 'list_artworks',
    annotations: { readOnlyHint: true },
    label: 'What hangs where',
    description: 'Titles, artists and dates of the works in one wing, or across the whole museum. Use it to pick stops for plan_tour or a work for view_artwork.',
    inputSchema: {
      type: 'object',
      properties: { wing: { type: 'string', description: 'Wing id. Omit for the whole collection.', enum: ['impressionists', 'van-gogh', 'ukiyo-e', 'dutch-cabinet'] } },
    },
    keywords: ['artworks', 'paintings', 'titles', 'catalogue'],
  },
  {
    name: 'look_around',
    annotations: { readOnlyHint: true },
    label: 'Where am I?',
    description: 'Describe what is on screen right now: the room, the artwork in front of the visitor, its curator note, and neighbours.',
    keywords: ['current', 'status', 'describe'],
  },
  {
    name: 'wallet_status',
    annotations: { readOnlyHint: true },
    label: 'Wallet status',
    description: 'The visitor wallet: address, USDC balance, spending policy, tickets held and recent receipts.',
    keywords: ['balance', 'money', 'usdc', 'policy'],
  },
  {
    name: 'fund_wallet',
    label: 'Top up wallet (testnet)',
    description: 'Ask the museum faucet for a few cents of test USDC (Base Sepolia). Use when wallet_status shows a balance too low for a ticket.',
    keywords: ['faucet', 'top up', 'drip', 'testnet'],
  },
  {
    name: 'buy_ticket',
    label: 'Buy a ticket',
    description: 'Pay for a wing over x402 (HTTP 402, USDC). Applies the visitor\'s spending policy; may pause for their approval. Returns the ticket and settlement tx.',
    inputSchema: {
      type: 'object',
      properties: {
        wing: {
          type: 'string',
          description: 'Wing id from list_wings, or "day-pass" for every wing.',
          enum: ['impressionists', 'van-gogh', 'ukiyo-e', 'dutch-cabinet', 'day-pass'],
        },
      },
      required: ['wing'],
    },
    keywords: ['pay', 'purchase', 'admission', 'x402'],
  },
  {
    name: 'enter_wing',
    label: 'Enter a wing',
    description: 'Walk into a wing you hold a ticket for and show its first artwork. Fails with the price if no ticket — buy_ticket first.',
    inputSchema: {
      type: 'object',
      properties: {
        wing: { type: 'string', description: 'Wing id from list_wings.', enum: ['impressionists', 'van-gogh', 'ukiyo-e', 'dutch-cabinet'] },
      },
      required: ['wing'],
    },
    keywords: ['go to', 'room', 'visit', 'open'],
  },
  {
    name: 'view_artwork',
    label: 'Go to an artwork',
    description: 'Bring a specific work in front of the visitor by title, artist or id (e.g. "Great Wave", "Milkmaid"). Needs a ticket for its wing.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Title, artist, or artwork id.' } },
      required: ['query'],
    },
    keywords: ['show', 'find', 'painting', 'print'],
  },
  {
    name: 'walk',
    label: 'Next / previous artwork',
    description: 'Move to the next or previous artwork in the current wing.',
    inputSchema: {
      type: 'object',
      properties: { direction: { type: 'string', description: 'Which way to walk.', enum: ['next', 'previous'], default: 'next' } },
      required: ['direction'],
    },
    keywords: ['next', 'previous', 'back', 'forward'],
  },
  {
    name: 'undo',
    label: 'Undo the last step',
    description:
      'Take back the last thing that changed the museum — a move, a spotlight, a tour edit. Payments cannot be undone: a ticket you bought stays bought, and this tool will say so.',
    keywords: ['undo', 'back', 'revert', 'mistake'],
  },
  {
    name: 'receipts',
    annotations: { readOnlyHint: true },
    label: 'Receipts & tickets',
    description: 'Every payment this visitor has made: amount, what for, settlement tx, and the tickets it bought.',
    keywords: ['history', 'transactions', 'stubs'],
  },
  // ── the docent layer ──
  {
    name: 'plan_tour',
    label: 'Plan a guided tour',
    description:
      'Propose a guided tour: a theme plus ordered stops (artwork title/id, your docent note, optional spotlight region). Groups stops by room, prices the doors, and shows the itinerary to the visitor — who can reorder or drop stops before you start_tour.',
    inputSchema: {
      type: 'object',
      properties: {
        theme: { type: 'string', description: 'Tour title, e.g. "Light and weather" or "Ten minutes of Vermeer".' },
        stops: STOPS_SCHEMA,
      },
      required: ['theme', 'stops'],
    },
    keywords: ['tour', 'itinerary', 'docent', 'guide'],
  },
  {
    name: 'take_tour',
    label: 'Take a curated tour',
    description: 'Load one of the museum’s own guided tours by id (list_wings shows them, with themes and how long each takes). This loads the whole itinerary — do NOT follow it with plan_tour; go straight to start_tour, which buys the doors and walks to stop 1.',
    inputSchema: {
      type: 'object',
      properties: { tour: { type: 'string', description: 'Tour id from list_wings, e.g. "light".', enum: ['light', 'faces', 'water'] } },
      required: ['tour'],
    },
    keywords: ['curated', 'museum tour', 'guided'],
  },
  {
    name: 'save_tour',
    label: 'Save this tour as a page',
    description: 'Publish the current tour — its works, your notes and what admission cost — as a keepsake web page the visitor can keep and share. Returns the URL.',
    keywords: ['publish', 'share', 'keep', 'link'],
  },
  {
    name: 'start_tour',
    label: 'Start the tour',
    description: 'Begin the proposed tour: buys the cheapest set of doors it needs (single tickets or a day pass) within the visitor’s spending policy, then walks to stop 1.',
    keywords: ['begin', 'go'],
  },
  {
    name: 'tour_step',
    label: 'Next / previous stop',
    description: 'Move along the tour: shows the stop’s artwork, applies its spotlight and note. Returns what is now on the wall and what comes next. At the end, the tour finishes.',
    inputSchema: {
      type: 'object',
      properties: { direction: { type: 'string', description: 'Which way along the itinerary.', enum: ['next', 'previous'], default: 'next' } },
      required: ['direction'],
    },
    keywords: ['next stop', 'continue', 'back'],
  },
  {
    name: 'end_tour',
    label: 'End the tour',
    description: 'Close the current tour and clear its itinerary.',
    keywords: ['stop tour', 'finish'],
  },
  {
    name: 'spotlight',
    label: 'Spotlight a detail',
    description:
      'Point the visitor at a detail: zooms into a region of the artwork on the wall (fractions of width/height, 0–1) and shows your note as docent wall text. Omit the region to just add a note; omit everything to clear.',
    inputSchema: {
      type: 'object',
      properties: {
        artwork: { type: 'string', description: 'Title or id. Defaults to what is on the wall.' },
        x: { type: 'number', description: 'Left edge of the region, 0–1.', minimum: 0, maximum: 1 },
        y: { type: 'number', description: 'Top edge, 0–1.', minimum: 0, maximum: 1 },
        w: { type: 'number', description: 'Width, 0–1.', minimum: 0, maximum: 1 },
        h: { type: 'number', description: 'Height, 0–1.', minimum: 0, maximum: 1 },
        note: { type: 'string', description: 'What to say about it (one or two sentences).' },
      },
    },
    keywords: ['zoom', 'detail', 'look at', 'highlight'],
  },
  {
    name: 'compare',
    label: 'Compare two works',
    description: 'Hang two works side by side (titles or ids). Both rooms need tickets — the error tells you which to buy. Any walk or view_artwork returns to a single wall.',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'string', description: 'First artwork (title or id).' },
        b: { type: 'string', description: 'Second artwork (title or id).' },
      },
      required: ['a', 'b'],
    },
    keywords: ['side by side', 'versus', 'both'],
  },
  {
    name: 'ask_docent',
    label: 'Ask the docent about this spot',
    description: 'Ask the museum’s own docent (a vision model on the box office) what is at the spot the visitor pointed at. Returns its answer and spotlights the region. Available once the visitor has clicked a spot.',
    inputSchema: { type: 'object', properties: { question: { type: 'string', description: 'Optional question about the spot.' } } },
    keywords: ['what is that', 'docent', 'explain'],
  },
  {
    name: 'whos_here',
    annotations: { readOnlyHint: true },
    label: 'Recent admissions',
    description: 'Who has been admitted recently: wing, price paid, payer, settlement tx. Live from the box office.',
    keywords: ['ticker', 'recent', 'settlements', 'visitors'],
  },
  {
    name: 'go_to_lobby',
    label: 'Back to the lobby',
    description: 'Leave the current wing and return to the entrance hall.',
    keywords: ['exit', 'home', 'entrance'],
  },
]

/**
 * What a tool costs the visitor, right now, as a display string — or null when
 * it's free. Prices are live: `start_tour` quotes the actual doors the current
 * itinerary still needs, and `buy_ticket` narrows as rooms are bought.
 */
export function toolPrice(name: string): string | null {
  const s = S.getState()
  const m = s.museum
  if (!m) return null
  switch (name) {
    case 'buy_ticket': {
      if (s.tickets['*']) return null
      const prices = WING_IDS.filter((w) => !S.hasTicket(w)).map((w) => parseFloat((S.wingOf(w)?.price ?? '$0').replace('$', '')))
      if (!prices.length) return null
      const lo = Math.min(...prices)
      const hi = Math.max(...parseFloat(m.dayPass.price.replace('$', '')) > Math.max(...prices) ? [...prices, parseFloat(m.dayPass.price.replace('$', ''))] : prices)
      return lo === hi ? `$${lo.toFixed(2)}` : `$${lo.toFixed(2)}–$${hi.toFixed(2)}`
    }
    case 'start_tour': {
      const c = S.tourCost()
      return c.cost > 0 ? `$${c.cost.toFixed(2)}` : null
    }
    default:
      return null
  }
}

/**
 * The tools that exist right now. WebMCP tools are live affordances, not a
 * static menu: you can't `walk` from the lobby, `buy_ticket` only offers wings
 * you don't hold, `enter_wing` only lists wings you do, and the faucet
 * disappears once the wallet is funded. agentk re-registers on change, which
 * fires the browser's `toolchange` event for listening agents.
 */
export function useTools(): AgentKToolDef[] {
  const s = useMuseum()
  const pass = !!s.tickets['*']
  const held = WING_IDS.filter((w) => S.hasTicket(w))
  const inWing = s.view.screen === 'wing'
  const onWall = s.view.screen !== 'lobby'
  const funded = (s.balance ?? 0) >= 0.05
  const tourStatus = s.tour?.status ?? 'none'
  const docentReady = inWing && S.docentEnabled() && !!s.pointing && s.pointing.artworkId === S.currentArtwork()?.id
  const undoable = s.undo.length > 0
  const signature = [held.join(','), pass, inWing, onWall, funded, tourStatus, docentReady, undoable].join('|')
  return useMemo(() => {
    const buyable: string[] = pass ? [] : [...WING_IDS.filter((w) => !held.includes(w)), 'day-pass']
    const list: AgentKToolDef[] = []
    for (const t of TOOLS) {
      if (t.name === 'buy_ticket') {
        if (buyable.length) list.push(withEnum(t, 'wing', buyable))
        continue
      }
      if (t.name === 'enter_wing') {
        if (held.length) list.push(withEnum(t, 'wing', held))
        continue
      }
      if (t.name === 'walk' && !inWing) continue
      if (t.name === 'go_to_lobby' && !onWall) continue
      if (t.name === 'fund_wallet' && funded) continue
      if (t.name === 'take_tour' && tourStatus !== 'none') continue
      if (t.name === 'save_tour' && tourStatus === 'none') continue
      if (t.name === 'start_tour' && tourStatus !== 'proposed') continue
      if (t.name === 'tour_step' && (tourStatus === 'none' || tourStatus === 'done')) continue
      if (t.name === 'end_tour' && tourStatus === 'none') continue
      if (t.name === 'spotlight' && !inWing) continue
      if (t.name === 'ask_docent' && !docentReady) continue
      if (t.name === 'undo' && !undoable) continue
      list.push(t)
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])
}

function withEnum(t: AgentKToolDef, prop: string, values: string[]): AgentKToolDef {
  if (!t.inputSchema) return t
  return { ...t, inputSchema: { ...t.inputSchema, properties: { ...t.inputSchema.properties, [prop]: { ...t.inputSchema.properties[prop], enum: values } } } }
}

/** Executes a tool for either surface. `via` marks who asked, for the ledger. */
export function makeExecutor(via: 'agent' | 'human') {
  const run = makeRunner(via)
  if (via !== 'agent') return run
  // WebMCP is agent-initiated: the page cannot speak until the agent calls a
  // tool. So every result to an agent carries what the visitor did in the
  // meantime — pointed at a detail, dropped a tour stop, changed their limit —
  // which is the "back and forth" Chrome's tool-design guide describes.
  return async function executeTool(name: string, params: Record<string, any> = {}) {
    const result = await run(name, params)
    const s = S.getState()
    const art = S.currentArtwork()
    const p = s.pointing && art && s.pointing.artworkId === art.id ? s.pointing : null
    const since = S.drainSinceAgent()
    if (result && typeof result === 'object' && !Array.isArray(result) && (since.length || (p && name !== 'look_around'))) {
      return {
        ...result,
        ...(since.length ? { sinceYourLastCall: since } : {}),
        ...(p && name !== 'look_around' ? { visitorPointing: { x: Number(p.x.toFixed(2)), y: Number(p.y.toFixed(2)), artwork: art!.title, hint: 'The visitor clicked this spot — they may want to know what it is. look_around describes it; spotlight it or answer.' } } : {}),
      }
    }
    return result
  }
}

function makeRunner(via: 'agent' | 'human') {
  return async function executeTool(name: string, params: Record<string, any> = {}) {
    const s = S.getState()
    const m = s.museum
    switch (name) {
      case 'list_wings': {
        if (!m) throw new Error('Box office unreachable.')
        return {
          museum: m.name,
          network: m.network,
          youAreIn: s.view.screen === 'wing' ? s.view.wing : s.view.screen,
          wings: m.wings.map((w) => ({
            id: w.id,
            name: w.name,
            price: w.price,
            ticket: S.hasTicket(w.id) ? 'held' : 'needed',
            works: w.artworkCount,
            about: w.tagline,
          })),
          dayPass: { id: m.dayPass.id, price: m.dayPass.price, covers: 'every wing', ticket: s.tickets['*'] ? 'held' : 'needed' },
          curatedTours: S.curatedTours().map((t) => ({ id: t.id, theme: t.theme, minutes: t.minutes, stops: t.stops.length, rooms: t.wings })),
          howTo: 'buy_ticket → enter_wing → walk / view_artwork / spotlight / compare. Guided: take_tour(id), or list_artworks + plan_tour for your own → start_tour → tour_step → save_tour.',
          payment: { rails: (m.networks ?? []).map((n) => n.label), directApi: `${BOX_OFFICE}/tickets/{wing} — pay the 402 with your own x402 wallet` },
        }
      }
      case 'list_artworks': {
        const wing = params.wing ? String(params.wing) : null
        const wings = (m?.wings ?? []).filter((w) => !wing || w.id === wing)
        if (wing && !wings.length) throw new Error(`Unknown wing "${wing}".`)
        if (wing)
          return {
            wing: S.wingOf(wing)?.name,
            artworks: wings[0].teasers.map((t) => ({ id: t.id, title: t.title, artist: t.artist, date: t.date, size: t.size })),
          }
        return {
          artworks: Object.fromEntries(wings.map((w) => [w.id, w.teasers.map((t) => `${t.title} — ${t.artist.split(' (')[0]}`)])),
          note: 'Pass any title to view_artwork, compare or plan_tour. Call with a wing id for dates and detail.',
        }
      }
      case 'look_around': {
        const t = s.tour
        const tour = t
          ? { theme: t.theme, status: t.status, stop: t.cursor + 1, of: t.stops.length, current: t.stops[t.cursor]?.title ?? null, next: t.stops[t.cursor + 1]?.title ?? null, itinerary: t.stops.map((x) => x.title), doors: S.tourCost(t).label }
          : null
        if (s.view.screen === 'lobby') {
          return { room: 'lobby', description: 'The entrance hall. Four wing doors and the admission board.', wingsHeld: Object.keys(s.tickets), tour }
        }
        if (s.view.screen === 'compare') {
          const a = S.findArtwork(s.view.a)?.art, b = S.findArtwork(s.view.b)?.art
          return { room: 'compare', comparing: [a, b].map((x) => x && { id: x.id, title: x.title, artist: x.artist, date: x.date, note: x.note }), tour }
        }
        const list = s.works[s.view.wing] ?? []
        const art = list[s.view.index]
        const w = S.wingOf(s.view.wing)
        const p = s.pointing && art && s.pointing.artworkId === art.id ? s.pointing : null
        return {
          room: w?.name,
          position: `${s.view.index + 1} of ${list.length}`,
          artwork: art && {
            id: art.id, title: art.title, artist: art.artist, date: art.date, medium: art.medium,
            // The wall hangs everything to scale, so the agent should know how big
            // the thing in front of the visitor actually is — it is most of what a
            // docent has to say, and reproductions never tell you.
            size: `${art.heightCm} × ${art.widthCm} cm`,
            museum: art.museum, note: art.note,
          },
          spotlight: s.spotlight && art && s.spotlight.artworkId === art.id ? { region: s.spotlight.region, note: s.spotlight.note } : null,
          visitorPointing: p
            ? { x: Number(p.x.toFixed(2)), y: Number(p.y.toFixed(2)), description: `The visitor clicked ${Math.round(p.x * 100)}% from the left, ${Math.round(p.y * 100)}% from the top of “${art!.title}” — they probably want to know what that is. Answer, or spotlight it.` }
            : null,
          previous: list[s.view.index - 1]?.title ?? null,
          next: list[s.view.index + 1]?.title ?? null,
          tour,
        }
      }
      case 'wallet_status': {
        const bal = (await S.refreshBalance().catch(() => s.balance)) ?? s.balance
        return {
          address: s.wallet?.address,
          network: 'Base Sepolia (eip155:84532)',
          usdc: bal,
          policy: s.policy.askEveryTime ? 'ask the visitor before every payment' : `auto-approve up to $${s.policy.autoApproveUpToUsd.toFixed(2)} per payment`,
          tickets: Object.values(s.tickets).map((t) => ({ wing: t.wing, price: t.price, expiresAt: t.expiresAt })),
          receipts: s.receipts.length,
          hint: (bal ?? 0) < 0.02 ? 'Balance is too low for a ticket — call fund_wallet.' : undefined,
        }
      }
      case 'fund_wallet': {
        const r = await S.fundWallet(via)
        if (!r.ok) throw new Error(`${r.error}${r.hint ? `: ${r.hint}` : ''}`)
        return { funded: r.amount + ' USDC', txHash: r.txHash, explorer: r.explorer, balance: S.getState().balance }
      }
      case 'buy_ticket': {
        const t = await S.buyTicket(String(params.wing ?? ''), via)
        return {
          ticket: { wing: t.wing, name: t.wingName, price: t.price, payer: short(t.payer), expiresAt: t.expiresAt },
          settlement: t.txHash ? { txHash: t.txHash, explorer: t.explorer } : 'already held',
          next: t.wing === '*' ? 'enter_wing(any wing)' : `enter_wing("${t.wing}")`,
        }
      }
      case 'enter_wing': {
        const works = await S.enterWing(String(params.wing ?? ''), via)
        const w = S.wingOf(String(params.wing))
        return { entered: w?.name, showing: works[0]?.title, artworks: works.map((a) => `${a.title} — ${a.artist}`) }
      }
      case 'view_artwork': {
        const a = await S.viewArtwork(String(params.query ?? ''), via)
        return { showing: a.title, artist: a.artist, date: a.date, medium: a.medium, museum: a.museum, note: a.note }
      }
      case 'walk': {
        const r = S.walk(params.direction === 'previous' ? 'previous' : 'next')
        return r.atEnd ? { atEnd: true, message: 'End of the room.', showing: r.artwork?.title } : { showing: r.artwork.title, artist: r.artwork.artist, note: r.artwork.note }
      }
      case 'undo': {
        const last = S.lastUndo()
        if (!last) throw new Error('Nothing to undo yet.')
        const r = S.undoTo(last.id, via)
        return { ...r, note: r.moneyKept ? `Reverted. ${r.moneyKept} of admission stays spent — tickets are not refundable, which is why buying asks first.` : 'Reverted.' }
      }
      case 'receipts':
        return {
          receipts: s.receipts.map((r) => ({ paid: `$${r.amountUsd.toFixed(2)}`, for: r.description, txHash: r.txHash, explorer: r.explorer, at: new Date(r.at).toISOString() })),
          tickets: Object.values(s.tickets).map((t) => ({ wing: t.wingName, expiresAt: t.expiresAt })),
        }
      case 'plan_tour': {
        let stops = params.stops
        if (typeof stops === 'string') {
          try {
            stops = JSON.parse(stops)
          } catch {
            throw new Error('stops must be an array of { artwork, note?, spotlight? }.')
          }
        }
        if (!Array.isArray(stops)) throw new Error('stops must be an array of { artwork, note?, spotlight? }.')
        const r = S.planTour(String(params.theme ?? ''), stops, via)
        return {
          tour: { theme: r.tour.theme, stops: r.tour.stops.map((x, i) => ({ n: i + 1, title: x.title, room: S.wingOf(x.wing)?.name, note: x.note || undefined })) },
          doors: r.cost.needed.length ? { needed: r.cost.needed, willBuy: r.cost.buy, cost: `$${r.cost.cost.toFixed(2)}`, label: r.cost.label } : 'all doors already open',
          unknown: r.unknown.length ? r.unknown : undefined,
          next: 'The visitor can reorder or drop stops in the tour panel. Call start_tour to buy the doors (within their policy) and walk to stop 1.',
        }
      }
      case 'take_tour': {
        const r = S.takeTour(String(params.tour ?? ''), via)
        return {
          tour: { theme: r.tour.theme, stops: r.tour.stops.map((x, i) => ({ n: i + 1, title: x.title, room: S.wingOf(x.wing)?.name })) },
          doors: r.cost.needed.length ? { willBuy: r.cost.buy, cost: `$${r.cost.cost.toFixed(2)}`, label: r.cost.label } : 'all doors already open',
          next: 'start_tour buys the doors (within the visitor’s policy) and walks to stop 1.',
        }
      }
      case 'save_tour':
        return S.saveTour(via)
      case 'start_tour':
        return S.startTour(via)
      case 'tour_step':
        return S.tourStep(params.direction === 'previous' ? 'previous' : 'next', via)
      case 'end_tour':
        S.endTour(via)
        return { ended: true }
      case 'spotlight': {
        const has = (k: string) => params[k] != null && params[k] !== ''
        const region = has('x') && has('y') && has('w') && has('h') ? { x: Number(params.x), y: Number(params.y), w: Number(params.w), h: Number(params.h) } : undefined
        return S.spotlight({ artwork: params.artwork ? String(params.artwork) : undefined, region, note: params.note ? String(params.note) : undefined }, via)
      }
      case 'compare':
        return S.compareWorks(String(params.a ?? ''), String(params.b ?? ''), via)
      case 'ask_docent':
        return S.askDocent(params.question ? String(params.question) : undefined, via)
      case 'whos_here': {
        const r = await S.loadSettlements()
        if (!r) return { admissions: [], note: 'The box office ticker is unavailable.' }
        return {
          last24h: r.last24h,
          total: r.total,
          admissions: r.settlements.slice(0, 8).map((x) => ({ wing: x.wingName, paid: x.price, payer: x.payer, when: new Date(x.at).toISOString(), txHash: x.txHash, explorer: x.explorer })),
        }
      }
      case 'go_to_lobby':
        S.goLobby()
        return { room: 'lobby' }
      default:
        throw new Error(`Unknown tool ${name}`)
    }
  }
}

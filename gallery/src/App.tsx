import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Command, useWebMCPRegistration } from '@stevysmith/agentk'
import * as S from './store'
import { useMuseum } from './store'
import { TOOLS, useTools, makeExecutor, toolPrice } from './tools'
import { teaser } from './teasers'
import { short, EXPLORER } from './wallet'
import { BOX_OFFICE, type WingSummary } from './api'

S.setTeaserLookup((file) => teaser(file))

const agentExec = makeExecutor('agent')
const humanExec = makeExecutor('human')
const ROOM_NO: Record<string, string> = { impressionists: 'I', 'van-gogh': 'II', 'ukiyo-e': 'III', 'dutch-cabinet': 'IV' }
/** Human-initiated actions: errors go to the ledger, not the console. */
const run = (p: Promise<unknown>) => p.catch((e: any) => S.log('error', e?.message ?? String(e)))

export function App() {
  const s = useMuseum()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [walletOpen, setWalletOpen] = useState(false)
  const [surfaceOpen, setSurfaceOpen] = useState(false)
  const tools = useTools()
  const { active } = useWebMCPRegistration(tools, agentExec, { prefix: 'gallery_' })

  useEffect(() => {
    S.init()
    S.loadSettlements()
    const t = setInterval(() => S.loadSettlements(), 20_000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    S.setWebmcp(active)
    if (active) S.log('info', `WebMCP: ${tools.length} tools registered on this page. Your agent can see the box office.`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
        return
      }
      const st = S.getState()
      if (st.confirm || paletteOpen) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (st.view.screen === 'wing') {
        if (e.key === 'ArrowRight') S.walk('next')
        if (e.key === 'ArrowLeft') S.walk('previous')
        if (e.key === 'Escape') (st.spotlight ? S.clearSpotlight() : S.goLobby())
      }
      if (st.view.screen === 'compare' && e.key === 'Escape') S.goLobby()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paletteOpen])

  const wing = s.view.screen === 'wing' ? s.view.wing : s.view.screen === 'compare' ? S.findArtwork(s.view.a)?.wing : undefined

  // The tab reads like the wall plaque of the room you are standing in; the
  // "Payment Required" comes back when you step out to the lobby.
  useEffect(() => {
    const room = wing ? S.wingOf(wing) : undefined
    document.title = room ? `Room ${ROOM_NO[room.id]} · ${room.name} — Gallery 402` : 'Gallery 402 — Payment Required'
  }, [wing])

  return (
    <div className="app" data-wing={wing ?? 'lobby'} data-screen={s.view.screen}>
      <TopBar
        onPalette={() => setPaletteOpen(true)}
        onWallet={() => setWalletOpen((o) => !o)}
        walletOpen={walletOpen}
        onSurface={() => setSurfaceOpen((o) => !o)}
        surfaceOpen={surfaceOpen}
      />
      {surfaceOpen && <ToolSurface tools={tools} onClose={() => setSurfaceOpen(false)} />}
      {walletOpen && <WalletPanel onClose={() => setWalletOpen(false)} />}
      <main className="stage">
        {s.error && (
          <div className="notice">
            <strong>Box office closed.</strong> {s.error}
          </div>
        )}
        {s.view.screen === 'lobby' ? <Lobby onPalette={() => setPaletteOpen(true)} /> : s.view.screen === 'compare' ? <CompareView /> : <WingView />}
      </main>
      {s.tour && s.view.screen !== 'lobby' && <TourPanel />}
      <Ledger />
      {s.confirm && <ConfirmSheet />}
      <Palette open={paletteOpen} onOpenChange={setPaletteOpen} tools={tools} />
      {s.busy && (
        <div className="busy" role="status">
          <span className="busy-dot" /> {s.busy}…
        </div>
      )}
    </div>
  )
}

// ─── top bar ─────────────────────────────────────────────────────────────

function TopBar({
  onPalette,
  onWallet,
  walletOpen,
  onSurface,
  surfaceOpen,
}: {
  onPalette: () => void
  onWallet: () => void
  walletOpen: boolean
  onSurface: () => void
  surfaceOpen: boolean
}) {
  const s = useMuseum()
  const count = useTools().length
  // Flash the pill whenever the number of live tools changes, so the surface
  // moving is something the visitor notices rather than something only an
  // agent can see.
  const [delta, setDelta] = useState<number | null>(null)
  const prev = useRef(count)
  useEffect(() => {
    if (prev.current !== count) {
      const d = count - prev.current
      prev.current = count
      setDelta(d)
      const t = setTimeout(() => setDelta(null), 2200)
      return () => clearTimeout(t)
    }
  }, [count])
  return (
    <header className="topbar">
      <button className="wordmark" onClick={() => S.goLobby()} aria-label="Gallery 402, back to lobby">
        <span className="wordmark-name">Gallery 402</span>
        <span className="wordmark-sub">Payment Required</span>
      </button>
      <div className="topbar-right">
        <button
          className={`pill ${s.webmcp ? 'pill-on' : ''} ${surfaceOpen ? 'pill-open' : ''} ${delta ? 'pill-changed' : ''}`}
          onClick={onSurface}
          aria-expanded={surfaceOpen}
          title={
            s.webmcp
              ? `${count} WebMCP tools registered right now — see what your agent can do`
              : 'No agent is connected, but these are the tools one would see. Open the page in ChatGPT’s browser, or enable chrome://flags/#enable-webmcp-testing.'
          }
        >
          <span className="pill-dot" />
          <span>{s.webmcp ? `WebMCP · ${count} tools` : `Agent not connected · ${count} tools`}</span>
          {delta ? (
            <span className="pill-delta">
              {delta > 0 ? '+' : '−'}
              {Math.abs(delta)}
            </span>
          ) : null}
        </button>
        <button className={`chip ${walletOpen ? 'chip-active' : ''}`} onClick={onWallet} aria-expanded={walletOpen}>
          <span className="chip-label">Wallet</span>
          <span className="chip-value mono">{s.balance == null ? '—' : `$${s.balance.toFixed(2)}`}</span>
        </button>
        <button className="chip chip-k" onClick={onPalette} aria-label="Open command palette">
          <kbd>⌘K</kbd>
        </button>
      </div>
    </header>
  )
}

// ─── lobby ───────────────────────────────────────────────────────────────

/** Whole seconds since `active` became true; 0 while it is false. */
function useElapsed(active: boolean) {
  const [sec, setSec] = useState(0)
  useEffect(() => {
    if (!active) {
      setSec(0)
      return
    }
    const t0 = Date.now()
    const t = setInterval(() => setSec(Math.round((Date.now() - t0) / 1000)), 1000)
    return () => clearInterval(t)
  }, [active])
  return sec
}

/** What the admission board says while the box office is still waking. The
 *  free host sleeps between visitors, so a judge's first visit can wait ~20s
 *  with nothing else on the page changing — the line has to carry it. */
function wakingLine(sec: number) {
  if (sec < 8) return 'The box office is waking up.'
  if (sec < 16) return 'The box office sleeps between visitors — the first knock takes the longest.'
  return 'Still knocking. Prices and doors appear here the moment it answers.'
}

function Lobby({ onPalette }: { onPalette: () => void }) {
  const s = useMuseum()
  const m = s.museum
  const waited = useElapsed(s.loading && !m)
  const prompts = ['Get me into the Van Gogh room', 'Buy a day pass and show me the Great Wave', 'What does a ticket to the Dutch cabinet cost?']
  const [copied, setCopied] = useState<string | null>(null)
  const copy = (p: string) => {
    navigator.clipboard?.writeText(p).then(() => {
      setCopied(p)
      setTimeout(() => setCopied(null), 1400)
    })
  }
  return (
    <div className="lobby">
      <section className="hero">
        <p className="eyebrow">A virtual museum · four rooms · public-domain masterworks</p>
        <h1 className="display">
          You look at the paintings.
          <br />
          <em>Your agent buys the tickets.</em>
        </h1>
        <p className="lede">
          Each wing costs a few cents, charged over HTTP&nbsp;402. The box office is exposed as WebMCP tools, so an agent in your browser can pay inside a limit you set — and you never leave the room.
        </p>
      </section>

      {s.tour ? <TourPanel inline /> : <Tours />}

      {!m && s.loading && waited >= 2 && (
        <section className="board board-waking" aria-label="Admission" aria-live="polite">
          <h2 className="board-title">Admission</h2>
          <p className="waking-line">
            <span className="busy-dot" /> {wakingLine(waited)}
          </p>
        </section>
      )}

      {m && (
        <section className="board" aria-label="Admission prices">
          <h2 className="board-title">Admission</h2>
          <ul className="board-list">
            {m.wings.map((w) => (
              <BoardRow key={w.id} wing={w} />
            ))}
            <li className="board-row board-pass">
              <span className="board-name">{m.dayPass.name}</span>
              <span className="board-leader" />
              <span className="board-price mono">{m.dayPass.price}</span>
              {s.tickets['*'] ? (
                <span className="board-held">held</span>
              ) : (
                <button className="btn btn-brass" onClick={() => run(S.buyTicket('day-pass', 'human'))}>
                  Buy
                </button>
              )}
            </li>
          </ul>
          <p className="board-note">
            This wallet pays in test USDC on Base Sepolia.{' '}
            {m.networks?.some((n) => n.network === 'eip155:8453') && 'The box office also takes real USDC on Base from any x402 agent. '}
            Your spending policy: {s.policy.askEveryTime ? 'ask every time' : `auto-approve ≤ $${s.policy.autoApproveUpToUsd.toFixed(2)}`}.
          </p>
        </section>
      )}

      {m && (
        <section className="doors" aria-label="Wings">
          {m.wings.map((w) => (
            <Door key={w.id} wing={w} />
          ))}
        </section>
      )}

      <Ticker />

      <section className="agent-strip">
        <div className="agent-strip-head">
          <span className="eyebrow">Try it with an agent</span>
          <span className="muted">ChatGPT’s in-app browser sees these tools automatically. In Chrome, enable <code>chrome://flags/#enable-webmcp-testing</code>.</span>
        </div>
        <div className="prompts">
          {prompts.map((p) => (
            <button key={p} className="prompt" onClick={() => copy(p)} title="Copy">
              “{p}”<span className="prompt-copy">{copied === p ? 'copied' : 'copy'}</span>
            </button>
          ))}
        </div>
        <p className="muted">
          No agent handy? Press <kbd>⌘K</kbd> — the same tools are the command palette, and <button className="link" onClick={onPalette}>you can type a request to the in-page agent</button>.
        </p>
      </section>
    </div>
  )
}

/**
 * "What your agent can do here" — the live WebMCP surface, shown to the human.
 *
 * The catalogue narrows and widens with the page (see `useTools`), so this
 * panel animates entries in and out: walk into a room and three capabilities
 * appear. Paid tools carry their live price — `start_tour` quotes the doors the
 * current itinerary actually still needs.
 */
function ToolSurface({ tools, onClose }: { tools: typeof TOOLS; onClose: () => void }) {
  const s = useMuseum()
  type Row = { tool: (typeof TOOLS)[number]; state: 'in' | 'out' }
  const [rows, setRows] = useState<Row[]>(() => tools.map((tool) => ({ tool, state: 'in' as const })))
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    const live = new Set(tools.map((t) => t.name))
    setRows((prev) => {
      const kept = prev.filter((r) => live.has(r.tool.name) || r.state === 'out')
      const next: Row[] = tools.map((tool) => {
        const was = kept.find((r) => r.tool.name === tool.name)
        return { tool, state: 'in' as const, ...(was ? {} : {}) }
      })
      // anything that just disappeared lingers briefly, marked leaving
      for (const r of prev) {
        if (!live.has(r.tool.name) && r.state === 'in') {
          next.push({ tool: r.tool, state: 'out' })
          timers.current[r.tool.name] = setTimeout(() => setRows((cur) => cur.filter((x) => !(x.tool.name === r.tool.name && x.state === 'out'))), 900)
        }
      }
      return next
    })
    return () => {}
  }, [tools])
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), [])

  const live = tools.length
  return (
    <div className="surface" role="dialog" aria-label="What your agent can do here">
      <div className="surface-head">
        <div>
          <p className="eyebrow">What your agent can do — here, now</p>
          <p className="small muted">
            {live} tool{live === 1 ? '' : 's'} registered on this page. The list changes as you move; your agent sees exactly this.
          </p>
        </div>
        <button className="link" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <ul className="surface-list" aria-live="polite">
        {rows.map(({ tool, state }) => {
          const price = state === 'in' ? toolPrice(tool.name) : null
          return (
            <li key={`${tool.name}-${state}`} className={`surface-row ${state === 'out' ? 'is-leaving' : 'is-entering'}`}>
              <span className="surface-name mono">{tool.name}</span>
              <span className="surface-desc">{tool.label ?? tool.name}</span>
              {price ? (
                <span className="surface-price mono">{price}</span>
              ) : tool.annotations?.readOnlyHint ? (
                <span className="surface-tag">reads</span>
              ) : (
                <span className="surface-tag surface-tag-free">free</span>
              )}
            </li>
          )
        })}
      </ul>
      <p className="surface-foot small muted">
        Prices are what the visitor's wallet would pay over x402. Everything else is free — the museum covers the docent.
      </p>
    </div>
  )
}

function Tours() {
  const s = useMuseum()
  const tours = S.curatedTours()
  if (!tours.length) return null
  return (
    <section className="tours" aria-label="Guided tours">
      <div className="tours-head">
        <span className="eyebrow">Guided tours</span>
        <span className="muted small">Written by the museum. Your agent can write you a different one.</span>
      </div>
      <div className="tour-cards">
        {tours.map((t) => {
          const rooms = t.wings.map((w) => S.wingOf(w)?.name).filter(Boolean)
          const need = t.wings.filter((w) => !S.hasTicket(w))
          return (
            <button key={t.id} className="tour-card" onClick={() => run(Promise.resolve(S.takeTour(t.id, 'human')))} disabled={!!s.busy}>
              <span className="tour-card-theme">{t.theme}</span>
              <span className="tour-card-blurb">{t.blurb}</span>
              <span className="tour-card-meta mono">
                {t.stops.length} stops · {t.minutes} min · {rooms.length} room{rooms.length === 1 ? '' : 's'}
              </span>
              <span className="tour-card-cta">{need.length ? 'Preview the itinerary →' : 'All doors open · start →'}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function Ticker() {
  const s = useMuseum()
  const list = s.settlements.slice(0, 5)
  return (
    <section className="ticker" aria-label="Recent admissions">
      <div className="ticker-head">
        <span className="eyebrow">Recently admitted</span>
        <span className="muted small">{s.settlementsTotal === 0 ? 'No one yet today — be first.' : `${s.settlementsTotal} settlement${s.settlementsTotal === 1 ? '' : 's'} on record`}</span>
      </div>
      {list.length > 0 && (
        <ul className="ticker-list">
          {list.map((x) => (
            <li key={x.txHash} className="ticker-row">
              <span className="ticker-wing">{x.wingName}</span>
              <span className="mono">{x.price}</span>
              <span className="mono muted">{x.payer}</span>
              <span className="muted">{ago(x.at)}</span>
              <a className="mono" href={x.explorer} target="_blank" rel="noreferrer">
                {x.txHash.slice(2, 8)} ↗
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
function ago(t: number) {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  return `${Math.round(s / 86400)} d ago`
}

function BoardRow({ wing }: { wing: WingSummary }) {
  const held = S.hasTicket(wing.id)
  useMuseum()
  return (
    <li className="board-row">
      <span className="board-name">
        <span className="board-no">{ROOM_NO[wing.id]}</span> {wing.name}
      </span>
      <span className="board-leader" />
      <span className="board-price mono">{wing.price}</span>
      {held ? (
        <button className="btn btn-paper" onClick={() => run(S.enterWing(wing.id, 'human'))}>
          Enter
        </button>
      ) : (
        <button className="btn btn-brass" onClick={() => run(S.buyTicket(wing.id, 'human'))}>
          Buy
        </button>
      )}
    </li>
  )
}

function Door({ wing }: { wing: WingSummary }) {
  useMuseum()
  const held = S.hasTicket(wing.id)
  const enter = () => run(held ? S.enterWing(wing.id, 'human') : S.buyTicket(wing.id, 'human').then(() => S.enterWing(wing.id, 'human')))
  return (
    <button className={`door ${held ? 'door-open' : 'door-locked'}`} data-wing={wing.id} onClick={enter} aria-label={`${wing.name}, ${held ? 'enter' : `buy ticket ${wing.price}`}`}>
      <div className="door-mosaic">
        {wing.teasers.slice(0, 4).map((t) => (
          <img key={t.id} src={teaser(`${fileFor(wing, t.id)}`)} alt="" loading="lazy" />
        ))}
      </div>
      <div className="door-plaque">
        <span className="door-no">Room {ROOM_NO[wing.id]}</span>
        <span className="door-name">{wing.name}</span>
        <span className="door-tag">{wing.tagline}</span>
      </div>
      <div className={`door-status ${held ? 'is-open' : ''}`}>
        {held ? (
          <>Ticket held · enter</>
        ) : (
          <>
            <span className="code">402</span> Payment required · {wing.price}
          </>
        )}
      </div>
    </button>
  )
}

// teaser files are named after the artwork file; the API only sends ids/titles,
// so map id → file via the museum's public teaser list.
function fileFor(wing: WingSummary, id: string) {
  const t = wing.teasers.find((t) => t.id === id)
  return t?.teaser.replace('teasers/', '') ?? ''
}

// ─── wing ────────────────────────────────────────────────────────────────

function WingView() {
  const s = useMuseum()
  const view = s.view.screen === 'wing' ? s.view : null
  const wing = view ? S.wingOf(view.wing) : null
  const list = view ? s.works[view.wing] ?? [] : []
  const art = view ? list[view.index] : undefined
  // Which artwork id has finished loading. No reset effect: a cached image can
  // fire `load` before an effect runs, so we compare ids instead of clearing.
  const [loaded, setLoaded] = useState<string | null>(null)
  const imgRef = (el: HTMLImageElement | null) => {
    if (el && el.complete && el.naturalWidth > 0 && art) setLoaded(art.id)
  }
  const wallRef = useRef<HTMLDivElement>(null)
  const wallBox = useBox(wallRef)
  const { pxPerCm } = hangScale(wallBox)
  const hang = hangWall(list, pxPerCm)
  const spot = art && s.spotlight && s.spotlight.artworkId === art.id ? s.spotlight : null
  const pin = art && s.pointing && s.pointing.artworkId === art.id ? s.pointing : null
  const onPoint = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    S.setPointing(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)))
    // With the docent on duty, the click *is* the question. (WebMCP itself is
    // agent-initiated — a page can't push to the agent — so this is the page's
    // own docent answering; a WebMCP agent still reads the pin via look_around.)
    if (S.docentEnabled() && !S.getState().busy) run(S.askDocent(undefined, 'human'))
  }
  if (!view || !wing) return null
  return (
    <div className="wing">
      <div className="wing-head">
        <button className="link" onClick={() => S.goLobby()}>
          ← Lobby
        </button>
        <span className="eyebrow">
          Room {ROOM_NO[wing.id]} · {wing.name}
        </span>
        <span className="mono muted">
          {view.index + 1} / {list.length}
        </span>
      </div>
      {art ? (
        <div className="hang">
          <button className="walk walk-prev" onClick={() => S.walk('previous')} disabled={view.index === 0} aria-label="Previous artwork">
            ‹
          </button>
          <div className="wall" ref={wallRef}>
            <div className="track" style={{ transform: `translateX(${wallBox.w / 2 - (hang.centres[view.index] ?? 0)}px)` }}>
              {list.map((a, i) => {
                const active = i === view.index
                return (
                  <figure
                    key={a.id}
                    className={`slot ${active ? 'frame is-active' : i < view.index ? 'is-left' : 'is-right'}`}
                    style={{ width: hang.widths[i] }}
                    data-artwork={active ? a.id : undefined}
                    data-index={active ? i : undefined}
                    data-spotlight={active && spot?.region ? [spot.region.x, spot.region.y, spot.region.w, spot.region.h].map((n) => n.toFixed(2)).join(',') : undefined}
                    onClick={!active ? () => run(S.viewArtwork(a.id, 'human')) : undefined}
                  >
                    <div className={`frame-inner ${active && loaded === a.id ? 'is-loaded' : ''} ${active && spot?.region ? 'is-zoomed' : ''}`}>
                      <div className="zoom" style={active ? zoomStyle(spot?.region ?? null) : undefined} onClick={active ? onPoint : undefined} title={active ? 'Click a detail to point your agent at it' : a.title}>
                        <img
                          className="slot-teaser"
                          src={teaser(fileOf(a))}
                          alt=""
                          aria-hidden="true"
                          draggable={false}
                          style={pxPerCm ? { width: Math.round(a.widthCm * pxPerCm), height: Math.round(a.heightCm * pxPerCm) } : undefined}
                        />
                        {active && <img className="slot-full" key={a.id} ref={imgRef} src={a.image} alt={`${a.title}, ${a.artist}`} onLoad={() => setLoaded(a.id)} draggable={false} />}
                        {active && spot?.region && (
                          <div className="spot" aria-hidden="true">
                            <div className="spot-rect" style={{ left: `${spot.region.x * 100}%`, top: `${spot.region.y * 100}%`, width: `${spot.region.w * 100}%`, height: `${spot.region.h * 100}%` }} />
                          </div>
                        )}
                        {active && pin && <div className="pin" style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }} aria-label="You pointed here" />}
                      </div>
                    </div>
                  </figure>
                )
              })}
            </div>
          </div>
          <aside className="label">
            {!spot && !pin && <p className="hint small">Click any detail in the painting to ask about it.</p>}
            <h2 className="label-title">{art.title}</h2>
            <p className="label-artist">{art.artist}</p>
            <p className="label-meta">
              {art.date} · {art.medium}
            </p>
            <p className="label-size mono">
              {art.heightCm} × {art.widthCm} cm
              <span className="label-size-note">{sizeNoteOnce(art)}</span>
            </p>
            <p className="label-note">{art.note}</p>
            <p className="label-credit">
              {art.museum}. {art.credit}. Public domain.{' '}
              <a href={art.sourceUrl} target="_blank" rel="noreferrer">
                Source ↗
              </a>
            </p>
            {spot && (spot.note || spot.region) && (
              <div className="docent" data-docent>
                <span className="eyebrow">Docent</span>
                {spot.note ? <p>{spot.note}</p> : <p className="muted">Look here.</p>}
                {pin && S.docentEnabled() && <FollowUp />}
                <button className="link small" onClick={() => S.clearSpotlight()}>
                  clear spotlight
                </button>
              </div>
            )}
            {pin && !spot && <Pointed x={pin.x} y={pin.y} />}
          </aside>
          <button className="walk walk-next" onClick={() => S.walk('next')} disabled={view.index >= list.length - 1} aria-label="Next artwork">
            ›
          </button>
        </div>
      ) : (
        <p className="muted">Hanging the room…</p>
      )}
      <div className="rail" role="tablist" aria-label="Artworks in this wing">
        {list.map((a, i) => (
          <button key={a.id} role="tab" aria-selected={i === view.index} className={`rail-thumb ${i === view.index ? 'is-active' : ''}`} onClick={() => run(S.viewArtwork(a.id, 'human'))} title={a.title}>
            <img src={teaser(fileOf(a))} alt="" />
          </button>
        ))}
      </div>
    </div>
  )
}

/** A typed follow-up about the spot the visitor is pointing at. */
function FollowUp() {
  const s = useMuseum()
  const [q, setQ] = useState('')
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!q.trim()) return
    run(S.askDocent(q.trim(), 'human'))
    setQ('')
  }
  return (
    <form className="followup" onSubmit={submit}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about this spot…" aria-label="Ask the docent about this spot" disabled={!!s.busy} />
    </form>
  )
}

/** What happens after the visitor points at a spot depends on who is listening. */
function Pointed({ x, y }: { x: number; y: number }) {
  const s = useMuseum()
  const pct = `${Math.round(x * 100)}%, ${Math.round(y * 100)}%`
  if (S.docentEnabled()) {
    return (
      <div className="pointed">
        <p className="small">{s.busy ? `Asking the docent about ${pct}…` : `You pointed at ${pct}.`}</p>
        {!s.busy && (
          <button className="btn btn-brass" onClick={() => run(S.askDocent(undefined, 'human'))}>
            Ask the docent again
          </button>
        )}
      </div>
    )
  }
  if (s.webmcp) {
    return (
      <p className="pointed small">
        You pointed at {pct}. Ask your agent “what's that?” — it can see where you pointed.
      </p>
    )
  }
  return (
    <p className="pointed small">
      You pointed at {pct}, but no agent is listening to this page. Open it in ChatGPT's browser, enable WebMCP in Chrome, or give the box office an <code>ANTHROPIC_API_KEY</code> to put the docent on duty.
    </p>
  )
}

/** Size of an element, tracked with ResizeObserver (zero until mounted). */
function useBox(ref: React.RefObject<HTMLElement | null>) {
  const [box, setBox] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const r = el.getBoundingClientRect()
      setBox({ w: r.width, h: r.height })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return box
}

/** The biggest object in the collection, in cm — the scale everything else is hung against. */
const BIGGEST_CM = { w: 100.5, h: 106.9 }

/**
 * Hang the room to scale. One centimetres-per-pixel factor for the whole museum
 * means a 25 cm Hokusai print really is a quarter the size of a Van Gogh
 * canvas — the first thing anyone says out loud in a real gallery.
 *
 * The scale comes from the wall's height (so the largest work fills it), and
 * the slot width follows from the scale — not the other way round, which would
 * shrink every work to fit a slot sized for neighbours.
 */
function hangScale(box: { w: number; h: number }) {
  const frame = 28 // frame padding, both sides
  if (box.h <= 0 || box.w <= 0) return { pxPerCm: 0 }
  let pxPerCm = ((box.h - frame) * 0.94) / BIGGEST_CM.h
  // the widest work must still leave the neighbours peeking in
  const maxWork = box.w * 0.72 - frame
  if (BIGGEST_CM.w * pxPerCm > maxWork) pxPerCm = maxWork / BIGGEST_CM.w
  return { pxPerCm }
}

/** Air between neighbouring works, as a real wall would give them. */
const GUTTER = 96

/**
 * Lay the wall out work by work: each hangs at its own size, so a small print
 * leaves its neighbours visible and a large canvas crowds them out — which is
 * how a wall actually reads.
 */
function hangWall(list: { widthCm: number }[], pxPerCm: number) {
  const frame = 28
  const widths = list.map((a) => (pxPerCm ? Math.max(140, a.widthCm * pxPerCm + frame) : 240) + GUTTER)
  const centres: number[] = []
  let x = 0
  for (const w of widths) {
    centres.push(x + w / 2)
    x += w
  }
  return { widths, centres }
}
/** A plain-language sense of scale — the thing a docent says before anything else. */
/**
 * A plain-language handle on the size, because centimetres mean nothing to most
 * people standing in front of a painting. Every phrase describes the LONGEST
 * side, so it stays true whether the work is portrait or landscape.
 */
/**
 * A docent tells you a room of prints is laptop-sized once, not six times. Each
 * phrase is spent the first time the visitor meets it; after that the
 * centimetres stand on their own. Memoised per artwork so re-renders are stable.
 */
const spentNotes = new Set<string>()
const noteFor = new Map<string, string>()
function sizeNoteOnce(a: { id: string; widthCm: number; heightCm: number }): string {
  const cached = noteFor.get(a.id)
  if (cached !== undefined) return cached
  const note = sizeNote(a)
  const fresh = spentNotes.has(note) ? '' : note
  spentNotes.add(note)
  noteFor.set(a.id, fresh)
  return fresh
}

function sizeNote(a: { widthCm: number; heightCm: number }): string {
  const big = Math.max(a.widthCm, a.heightCm)
  if (big <= 34) return 'about the size of a sheet of paper'
  if (big <= 46) return 'about the size of an open laptop'
  if (big <= 64) return 'small enough to carry under one arm'
  if (big <= 82) return 'about an arm’s length across'
  if (big <= 98) return 'about a metre across'
  return 'more than a metre across'
}

/** The artwork's file name (teaser thumbnails are keyed by it). */
const fileOf = (a: { image: string }) => a.image.split('/art/')[1]?.split('?')[0] ?? ''

/** Zoom so the region fills ~¾ of the frame, centred. Translate first (in % of the element), then scale about the region's centre. */
function zoomStyle(r: S.Region | null): React.CSSProperties {
  if (!r) return { transform: 'none', transformOrigin: '50% 50%' }
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2
  const scale = Math.max(1, Math.min(3.2, Math.min(0.78 / r.w, 0.78 / r.h)))
  return { transformOrigin: `${cx * 100}% ${cy * 100}%`, transform: `translate(${(0.5 - cx) * 100}%, ${(0.5 - cy) * 100}%) scale(${scale.toFixed(3)})` }
}

function CompareView() {
  const s = useMuseum()
  if (s.view.screen !== 'compare') return null
  const a = S.findArtwork(s.view.a)?.art
  const b = S.findArtwork(s.view.b)?.art
  if (!a || !b) return null
  return (
    <div className="compare" data-compare={`${a.id}|${b.id}`}>
      <div className="wing-head">
        <button className="link" onClick={() => S.goLobby()}>
          ← Lobby
        </button>
        <span className="eyebrow">Side by side</span>
        <button className="link" onClick={() => run(S.viewArtwork(a.id, 'human'))}>
          single wall →
        </button>
      </div>
      <div className="compare-grid">
        {[a, b].map((art) => (
          <figure key={art.id} className="compare-item" data-artwork={art.id}>
            <div className="frame-inner is-loaded">
              <img src={art.image} alt={`${art.title}, ${art.artist}`} />
            </div>
            <figcaption className="label compare-label">
              <h2 className="label-title">{art.title}</h2>
              <p className="label-artist">
                {art.artist} · {art.date}
              </p>
              <p className="label-note">{art.note}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}

function TourPanel({ inline }: { inline?: boolean }) {
  const s = useMuseum()
  const [open, setOpen] = useState(true)
  const t = s.tour!
  const cost = S.tourCost(t)
  const rooms = new Set(t.stops.map((x) => x.wing)).size
  const status = t.status === 'proposed' ? 'proposed' : t.status === 'done' ? 'finished' : `stop ${t.cursor + 1} of ${t.stops.length}`
  return (
    <aside className={`tour ${open ? '' : 'tour-closed'} ${inline ? 'tour-inline' : ''}`} data-tour-status={t.status} data-tour-cursor={t.cursor} aria-label="Tour itinerary">
      <button className="ledger-toggle tour-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>Tour · {t.theme}</span>
        <span className="muted mono">{status}</span>
      </button>
      {open && (
        <>
          <ol className="tour-stops">
            {t.stops.map((stop, i) => (
              <li key={stop.id} className={`tour-stop ${i === t.cursor ? 'is-current' : ''} ${i < t.cursor ? 'is-done' : ''}`}>
                <button className="tour-go" onClick={() => run(S.viewArtwork(stop.artworkId, 'human'))} title="Jump to this stop">
                  <span className="tour-n mono">{i + 1}</span>
                  <span className="tour-title">{stop.title}</span>
                  <span className="tour-room muted small">{S.wingOf(stop.wing)?.name}{S.hasTicket(stop.wing) ? '' : ' · ticket needed'}</span>
                </button>
                <span className="tour-ctl">
                  <button onClick={() => S.moveStop(i, 'up')} aria-label="Move up" disabled={i === 0}>
                    ▲
                  </button>
                  <button onClick={() => S.moveStop(i, 'down')} aria-label="Move down" disabled={i === t.stops.length - 1}>
                    ▼
                  </button>
                  <button onClick={() => S.removeStop(i)} aria-label="Drop this stop">
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ol>
          <div className="tour-foot">
            <span className="small muted tour-doors">
              {t.status === 'done'
                ? `That’s the tour — ${t.stops.length} stop${t.stops.length === 1 ? '' : 's'} across ${rooms} room${rooms === 1 ? '' : 's'}. ${t.savedUrl ? 'The page is yours to keep.' : 'Save it as a page to keep the notes.'}`
                : cost.needed.length
                  ? `Doors: ${cost.label}`
                  : 'All doors open'}
            </span>
            <span className="tour-actions">
              {t.status === 'proposed' && (
                <button className="btn btn-brass" onClick={() => run(S.startTour('human'))} disabled={!!s.busy}>
                  Start tour{cost.cost ? ` · $${cost.cost.toFixed(2)}` : ''}
                </button>
              )}
              {t.status === 'active' && (
                <>
                  <button className="btn btn-ghost" onClick={() => run(S.tourStep('previous', 'human'))} disabled={t.cursor <= 0}>
                    ‹
                  </button>
                  <button className="btn btn-brass" onClick={() => run(S.tourStep('next', 'human'))}>
                    {t.cursor + 1 >= t.stops.length ? 'Finish' : 'Next stop'}
                  </button>
                </>
              )}
              {t.status !== 'proposed' &&
                (t.savedUrl ? (
                  <a className="link small" href={t.savedUrl} target="_blank" rel="noreferrer">
                    saved page ↗
                  </a>
                ) : (
                  <button className="link small" onClick={() => run(S.saveTour('human'))} disabled={!!s.busy}>
                    save page
                  </button>
                ))}
              <button className="link small" onClick={() => S.endTour('human')}>
                {t.status === 'done' ? 'close' : 'end'}
              </button>
            </span>
          </div>
        </>
      )}
    </aside>
  )
}

// ─── payment confirm (the box-office window) ─────────────────────────────

function ConfirmSheet() {
  const s = useMuseum()
  const q = s.confirm!.quote
  // "Gallery 402 — ticket to the Van Gogh Room. Arles and Saint-Rémy…" → what / tagline
  const [what, ...rest] = q.description.replace(/^Gallery 402 — /, '').replace(/\.$/, '').split('. ')
  const tagline = rest.join('. ')
  const approveRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    approveRef.current?.focus()
  }, [])
  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="window">
        <p className="eyebrow">Box office · approval needed</p>
        <h2 id="confirm-title" className="window-title">
          Pay <span className="mono">${q.amountUsd.toFixed(2)}</span> for a {what}?
        </h2>
        {tagline && <p className="muted">{tagline}</p>}
        <dl className="window-dl">
          <dt>To</dt>
          <dd className="mono">{short(q.payTo)}</dd>
          <dt>Network</dt>
          <dd>Base Sepolia · USDC</dd>
          <dt>Your policy</dt>
          <dd>{s.policy.askEveryTime ? 'ask every time' : `auto-approve ≤ $${s.policy.autoApproveUpToUsd.toFixed(2)}`}</dd>
        </dl>
        <div className="window-actions">
          <button className="btn btn-ghost" onClick={() => S.resolveConfirm(false)}>
            Decline
          </button>
          <button ref={approveRef} className="btn btn-brass" onClick={() => S.resolveConfirm(true)}>
            Approve payment
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ledger: stubs + activity ────────────────────────────────────────────

function Ledger() {
  const s = useMuseum()
  // Open in the lobby; tucked away in the rooms so it never sits on the label. The visitor's own toggle wins after that.
  const [open, setOpen] = useState(true)
  const [touched, setTouched] = useState(false)
  const screen = s.view.screen
  useEffect(() => {
    if (!touched) setOpen(screen === 'lobby')
  }, [screen, touched])
  const stubs = useMemo(() => Object.values(s.tickets).sort((a, b) => b.at - a.at), [s.tickets])
  const last = S.lastUndo()
  const entries = s.log.slice(-7)
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [s.log.length])
  return (
    <aside className={`ledger ${open ? '' : 'ledger-closed'}`} aria-label="Tickets and activity">
      <button
        className="ledger-toggle"
        onClick={() => {
          setTouched(true)
          setOpen((o) => !o)
        }}
        aria-expanded={open}
      >
        <span>Ledger</span>
        <span className="muted mono">{stubs.length} ticket{stubs.length === 1 ? '' : 's'}</span>
      </button>
      {/* The ledger tucks itself away inside a room — but that is exactly when a
          wrong turn happens, so the most recent undo stays reachable. */}
      {!open && last && (
        <div className="ledger-undo">
          <span className="small muted">{last.label}</span>
          <button className="act-undo" onClick={() => run(Promise.resolve(S.undoTo(last.id, 'human')))}>
            undo
          </button>
        </div>
      )}
      {open && (
        <>
          {stubs.length > 0 && (
            <div className="stubs">
              {stubs.map((t) => (
                <div key={t.wing + t.at} className="stub" data-wing={t.wing === '*' ? 'pass' : t.wing}>
                  <div className="stub-main">
                    <span className="stub-admit">Admit one</span>
                    <span className="stub-name">{t.wingName}</span>
                    <span className="stub-meta mono">
                      {t.price} · {short(t.payer)}
                    </span>
                  </div>
                  <div className="stub-tail">
                    {t.txHash ? (
                      <a className="mono" href={t.explorer} target="_blank" rel="noreferrer" title={t.txHash}>
                        {t.txHash.slice(2, 8)}
                      </a>
                    ) : (
                      <span className="mono muted">stub</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <ol className="activity">
            {entries.length === 0 && <li className="muted">Nothing yet. Buy a ticket, or ask your agent to.</li>}
            {entries.map((e) => {
              const undoable = e.undoId ? S.undoPoint(e.undoId) : null
              return (
                <li key={e.id} className={`act act-${e.kind}`}>
                  <span className="act-kind">{KIND_LABEL[e.kind]}</span>
                  <span className="act-text">
                    {e.text}
                    {e.href && (
                      <>
                        {' '}
                        <a href={e.href} target="_blank" rel="noreferrer">
                          view ↗
                        </a>
                      </>
                    )}
                  </span>
                  {undoable ? (
                    <button
                      className="act-undo"
                      onClick={() => run(Promise.resolve(S.undoTo(undoable.id, 'human')))}
                      title={undoable.spent ? `Goes back to before this. The $${undoable.spent.toFixed(2)} stays spent.` : 'Goes back to before this step.'}
                    >
                      undo
                    </button>
                  ) : e.irreversible ? (
                    <span className="act-final" title="Money moved, or a page was published. Undo can't reach it — which is why it asked first.">
                      final
                    </span>
                  ) : null}
                </li>
              )
            })}
            <div ref={endRef} />
          </ol>
        </>
      )}
    </aside>
  )
}
const KIND_LABEL: Record<S.LogKind, string> = { agent: 'agent', human: 'you', pay: 'x402', ok: 'ok', info: 'note', error: 'error' }

// ─── wallet panel ────────────────────────────────────────────────────────

function WalletPanel({ onClose }: { onClose: () => void }) {
  const s = useMuseum()
  const [copied, setCopied] = useState(false)
  const addr = s.wallet?.address ?? ''
  const copy = () =>
    navigator.clipboard?.writeText(addr).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    })
  return (
    <div className="wallet" role="dialog" aria-label="Visitor wallet">
      <div className="wallet-row">
        <div>
          <p className="eyebrow">Visitor wallet · this browser</p>
          <button className="mono wallet-addr" onClick={copy} title="Copy address">
            {addr} {copied ? '· copied' : ''}
          </button>
        </div>
        <button className="link" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <div className="wallet-balance">
        <span className="display">{s.balance == null ? '—' : `$${s.balance.toFixed(2)}`}</span>
        <span className="muted">USDC · Base Sepolia</span>
        <button className="link" onClick={() => S.refreshBalance()}>
          refresh
        </button>
      </div>
      <div className="wallet-actions">
        <button className="btn btn-brass" onClick={() => S.fundWallet('human')} disabled={!!s.busy}>
          Top up · free testnet USDC
        </button>
        <a className="link" href={`${EXPLORER}/address/${addr}`} target="_blank" rel="noreferrer">
          explorer ↗
        </a>
      </div>
      <fieldset className="policy">
        <legend className="eyebrow">Spending policy</legend>
        <label className="policy-row">
          <span>Auto-approve up to</span>
          <span className="mono">${s.policy.autoApproveUpToUsd.toFixed(2)}</span>
        </label>
        <input type="range" min={0} max={0.1} step={0.01} value={s.policy.autoApproveUpToUsd} onChange={(e) => S.setPolicy({ autoApproveUpToUsd: Number(e.target.value) })} disabled={s.policy.askEveryTime} aria-label="Auto-approve limit" />
        <label className="policy-row policy-check">
          <input type="checkbox" checked={s.policy.askEveryTime} onChange={(e) => S.setPolicy({ askEveryTime: e.target.checked })} />
          <span>Ask me before every payment</span>
        </label>
        <p className="muted small">Yours, not the agent’s. Agents can buy tickets through the page’s tools, but only within this limit — changing it is not a tool.</p>
      </fieldset>
      {s.receipts.length > 0 && (
        <div className="receipts">
          <p className="eyebrow">Receipts</p>
          {s.receipts.slice(0, 5).map((r) => (
            <div key={r.txHash} className="receipt">
              <span className="mono">${r.amountUsd.toFixed(2)}</span>
              <span className="receipt-for">{r.description.replace(/^Gallery 402 — /, '')}</span>
              <a className="mono" href={r.explorer} target="_blank" rel="noreferrer">
                {r.txHash.slice(2, 8)} ↗
              </a>
            </div>
          ))}
        </div>
      )}
      <button className="link danger" onClick={() => confirm('Discard this wallet, tickets and receipts, and start as a new visitor?') && S.resetVisitor()}>
        New visitor (discard this wallet)
      </button>
    </div>
  )
}

// ─── palette (agentk) ────────────────────────────────────────────────────

function Palette({ open, onOpenChange, tools }: { open: boolean; onOpenChange: (o: boolean) => void; tools: typeof TOOLS }) {
  const s = useMuseum()
  const agentEnabled = s.museum?.endpoints?.agent === 'enabled'
  const agent = useMemo(
    () =>
      agentEnabled
        ? ({ provider: 'anthropic', endpoint: `${BOX_OFFICE}/agent`, requireApproval: true, autoApproveReadOnly: true, maxSteps: 8 } as const)
        : undefined,
    [agentEnabled],
  )
  return (
    <Command.Dialog open={open} onOpenChange={onOpenChange} tools={tools} onToolExecute={humanExec} agent={agent} label="Gallery 402 box office">
      <Command.Input placeholder={agentEnabled ? 'Buy a ticket, enter a wing, or ask for anything…' : 'Buy a ticket, enter a wing…'} />
      <Command.List>
        <Command.Group heading="Box office">
          {tools.map((t) => (
            <Command.Tool key={t.name} tool={t} />
          ))}
        </Command.Group>
        <Command.Empty>No matching tool.</Command.Empty>
      </Command.List>
      <Command.AgentHint />
      <Command.Approval />
      <Command.ToolForm />
      <Command.ToolResult autoDismissAfterMs={5000} />
      <Command.ActivityFeed maxEntries={8} />
    </Command.Dialog>
  )
}

/** Typed client for the box office. Payment-aware calls live in wallet.ts. */

export const BOX_OFFICE: string = (import.meta.env.VITE_BOX_OFFICE_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:4402'

export type Teaser = { id: string; title: string; artist: string; date: string; size: string; teaser: string }
export type WingSummary = {
  id: string
  name: string
  tagline: string
  price: string
  endpoint: string
  artworkCount: number
  teasers: Teaser[]
}
export type DayPass = { id: string; name: string; price: string }
export type Settlement = { at: number; wing: string; wingName: string; price: string; payer: string; txHash: string; explorer: string; network: string }
export type Rail = { network: string; label: string; payTo: string; facilitator: string; audience: string }
export type CuratedTour = {
  id: string
  theme: string
  blurb: string
  minutes: number
  wings: string[]
  stops: { artwork: string; note: string; spotlight?: { x: number; y: number; w: number; h: number } }[]
}
export type Museum = {
  mode?: 'mock' | 'live'
  networks?: Rail[]
  tours?: CuratedTour[]
  name: string
  tagline: string
  network: string
  payTo: string
  facilitator: string
  wings: WingSummary[]
  dayPass: DayPass & { endpoint: string }
  endpoints: Record<string, string | null>
}
export type Artwork = {
  id: string
  title: string
  artist: string
  date: string
  medium: string
  widthCm: number
  heightCm: number
  size: string
  museum: string
  credit: string
  sourceUrl: string
  note: string
  image: string
}
export type Ticket = {
  ticket: string
  wing: string
  wingName: string
  payer: string
  price: string
  expiresAt: string
  txHash?: string
  network?: string
}

/**
 * The box office sleeps.
 *
 * On a free host it spins down after a few minutes idle, and the request that
 * wakes it can be dropped or refused outright rather than merely held — so the
 * first visitor after a quiet spell sees a hard failure, not a slow load. That
 * is the worst possible first impression for a museum whose whole claim is that
 * the payments are real.
 *
 * Retry a few times with growing gaps, and let the caller narrate the wait.
 */
export async function wakeable<T>(fn: () => Promise<T>, onWaking?: (attempt: number) => void): Promise<T> {
  const gaps = [0, 1500, 4000, 8000, 12000]
  let last: unknown
  for (let i = 0; i < gaps.length; i++) {
    if (gaps[i]) await new Promise((r) => setTimeout(r, gaps[i]))
    try {
      return await fn()
    } catch (e) {
      last = e
      // A cold start looks like a network failure, not an HTTP error — an HTTP
      // error means the box office is awake and genuinely objecting, so stop.
      if (!(e instanceof TypeError)) throw e
      onWaking?.(i + 1)
    }
  }
  throw last
}

export async function getMuseum(): Promise<Museum> {
  const r = await fetch(`${BOX_OFFICE}/`)
  if (!r.ok) throw new Error(`box office unreachable (${r.status})`)
  return r.json()
}

export async function getArtworks(wing: string, ticket: string): Promise<{ artworks: Artwork[] }> {
  const r = await fetch(`${BOX_OFFICE}/wings/${wing}/artworks`, { headers: { Authorization: `Ticket ${ticket}` } })
  if (r.status === 401) throw new Error('ticket_required')
  if (!r.ok) throw new Error(`could not load wing (${r.status})`)
  const data = await r.json()
  // image paths are box-office-relative
  data.artworks = data.artworks.map((a: Artwork) => ({ ...a, image: `${BOX_OFFICE}${a.image}` }))
  return data
}

export async function requestDrip(address: string): Promise<{ ok: boolean; txHash?: string; explorer?: string; amount?: string; error?: string; hint?: string }> {
  const r = await fetch(`${BOX_OFFICE}/faucet`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address }) })
  return r.json()
}

export async function getSettlements(): Promise<{ settlements: Settlement[]; total: number; last24h: number }> {
  const r = await fetch(`${BOX_OFFICE}/settlements`)
  if (!r.ok) throw new Error(`settlements unavailable (${r.status})`)
  return r.json()
}

export async function askDocent(body: { artworkId: string; x: number; y: number; question?: string; ticket: string }): Promise<{ answer: string; region: { x: number; y: number; w: number; h: number } | null; cached?: boolean }> {
  const r = await fetch(`${BOX_OFFICE}/docent`, { method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Ticket ${body.ticket}` }, body: JSON.stringify(body) })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.hint ?? data.error ?? `docent unavailable (${r.status})`)
  return data
}

/**
 * Publish a keepsake page of a tour to Stacktree's anonymous endpoint — no
 * account, no key; the visitor's own IP owns the rate limit and the page.
 */
export async function publishTour(html: string, name: string): Promise<{ url: string }> {
  const form = new FormData()
  form.append('file', new Blob([html], { type: 'text/html' }), 'index.html')
  form.append('csp_strict', 'false')
  const r = await fetch('https://api.stacktr.ee/sites', { method: 'POST', body: form })
  if (r.status === 429) throw new Error('Stacktree is rate-limiting this network — try again later.')
  if (!r.ok) throw new Error(`Could not publish the tour (${r.status}).`)
  const data = await r.json()
  if (!data?.url) throw new Error('Stacktree accepted the page but returned no URL.')
  return { url: data.url as string }
}

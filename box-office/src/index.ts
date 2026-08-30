/**
 * Gallery 402 — box office
 *
 * A small Hono service that sells museum tickets over HTTP 402 (x402 v2) and
 * serves the gated collection to ticket holders.
 *
 *   GET  /                      museum manifest (wings, prices, network, endpoints)
 *   GET  /wings                 public: wings + teaser artworks (locked)
 *   GET  /tickets/:wing         x402-protected: pay → signed ticket for that wing
 *   GET  /tickets/day-pass      x402-protected: pay once → ticket for every wing
 *   GET  /wings/:wing/artworks  ticket-gated: the full collection for a wing
 *   GET  /art/:file             ticket-gated: high-resolution artwork
 *   GET  /settlements           who has been admitted recently (tx hashes) — the lobby ticker
 *   POST /faucet                testnet drip so visitors' agents have something to spend
 *   POST /docent                the museum's own docent: what is at the spot the visitor clicked (vision)
 *   POST /agent                 optional proxy for the gallery's in-page agent (Anthropic)
 *   GET  /health
 */
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { paymentMiddleware, x402ResourceServer } from '@x402/hono'
import { HTTPFacilitatorClient, type RoutesConfig } from '@x402/core/server'
import { decodePaymentSignatureHeader, decodePaymentResponseHeader, encodePaymentRequiredHeader, encodePaymentResponseHeader } from '@x402/core/http'
import type { MiddlewareHandler } from 'hono'
import { ExactEvmScheme } from '@x402/evm/exact/server'
import { createFacilitatorConfig } from '@coinbase/x402'
import { readFile, stat } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { WINGS, ARTWORKS, MUSEUM, DAY_PASS, TOURS, type Wing, type Artwork } from './collection.js'
import { issueTicket, verifyTicket, admits, type TicketClaims } from './tickets.js'
import { createFaucet } from './faucet.js'
import { createDocent } from './docent.js'

// ─── config ───────────────────────────────────────────────────────────────

const env = process.env
const PORT = Number(env.PORT ?? 4402)
const PAY_TO = (env.PAY_TO ?? '0x92004ee34DF5Fc754198b7643a4555D9Dec69Bba') as `0x${string}`
const NETWORK = (env.X402_NETWORK ?? 'eip155:84532') as `${string}:${string}`
const FACILITATOR_URL = env.X402_FACILITATOR_URL ?? 'https://x402.org/facilitator'
/**
 * Second rail: real USDC on Base mainnet, settled by the Coinbase CDP
 * facilitator — the same setup Stacktree uses for its own x402 endpoints.
 * Enabled when CDP credentials are present. Visitors' in-page wallets stay on
 * testnet; this rail is for agents that arrive with a real wallet.
 */
const MAINNET = 'eip155:8453' as const
const PAY_TO_MAINNET = (env.PAY_TO_MAINNET ?? '0xcc985ba6934d134feec4824ba40258608f3a4333') as `0x${string}`
let MAINNET_ENABLED = !!(env.CDP_API_KEY_ID && env.CDP_API_KEY_SECRET) && env.X402_MAINNET !== 'off'
const TICKET_SECRET = env.TICKET_SECRET ?? randomBytes(32).toString('hex')
const TICKET_TTL_S = 24 * 60 * 60
const ART_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'art')
const ALLOWED_ORIGINS = (env.ALLOWED_ORIGINS ?? '*').split(',').map((s) => s.trim())
/** X402_MODE=mock: answer 402s and accept any signature without touching a chain. For evals and local UI work only. */
const MOCK = env.X402_MODE === 'mock'
const USDC: Record<string, string> = { 'eip155:84532': '0x036CbD53842c5426634e7929541eC2318f3dCF7e', 'eip155:8453': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' }
const EXPLORER: Record<string, string> = { 'eip155:84532': 'https://sepolia.basescan.org', 'eip155:8453': 'https://basescan.org' }
const PUBLIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public')

if (!env.TICKET_SECRET) console.warn('[box-office] TICKET_SECRET not set — tickets will not survive a restart')

// ─── x402 ─────────────────────────────────────────────────────────────────

const facilitators = [new HTTPFacilitatorClient({ url: FACILITATOR_URL })]
if (MAINNET_ENABLED) {
  // Probe the CDP facilitator before we advertise mainnet. Bad or placeholder
  // credentials must degrade to testnet-only, never break every ticket route.
  try {
    const cdp = new HTTPFacilitatorClient(createFacilitatorConfig(env.CDP_API_KEY_ID, env.CDP_API_KEY_SECRET))
    const supported = await cdp.getSupported()
    const ok = (supported.kinds ?? []).some((k: any) => k.network === MAINNET && k.scheme === 'exact')
    if (!ok) throw new Error(`facilitator does not list exact/${MAINNET}`)
    facilitators.push(cdp)
  } catch (err: any) {
    MAINNET_ENABLED = false
    console.warn(`[box-office] mainnet rail disabled — CDP facilitator check failed: ${String(err?.message ?? err).slice(0, 160)}`)
  }
}
const x402 = new x402ResourceServer(facilitators).register(NETWORK, new ExactEvmScheme())
if (MAINNET_ENABLED) x402.register(MAINNET, new ExactEvmScheme())

/** Every paid route accepts the testnet option first (what the gallery's visitor wallet picks) and, when enabled, real USDC on Base. */
const acceptsFor = (price: string) => [
  { scheme: 'exact', payTo: PAY_TO, price, network: NETWORK },
  ...(MAINNET_ENABLED ? [{ scheme: 'exact', payTo: PAY_TO_MAINNET, price, network: MAINNET }] : []),
]
const NETWORKS = [
  { network: NETWORK, label: 'Base Sepolia · test USDC', payTo: PAY_TO, facilitator: FACILITATOR_URL, audience: 'the visitor wallet in this page' },
  ...(MAINNET_ENABLED ? [{ network: MAINNET, label: 'Base · real USDC', payTo: PAY_TO_MAINNET, facilitator: 'https://api.cdp.coinbase.com/platform/v2/x402', audience: 'any x402 agent with a real wallet' }] : []),
]

/** One paid route per wing, plus the day pass. Prices are USD strings; the
 *  scheme resolves them to the network's default stablecoin (USDC). */
const routes: RoutesConfig = Object.fromEntries([
  ...WINGS.map((w) => [
    `GET /tickets/${w.id}`,
    {
      accepts: acceptsFor(w.price),
      description: `Gallery 402 — ticket to the ${w.name}. ${w.tagline}`,
      mimeType: 'application/json',
      serviceName: MUSEUM.name,
      unpaidResponseBody: () => ({
        contentType: 'application/json',
        body: { error: 'payment_required', wing: w.id, price: w.price, hint: `Pay ${w.price} over x402 to receive a ticket for the ${w.name}.` },
      }),
    },
  ]),
  [
    `GET /tickets/${DAY_PASS.id}`,
    {
      accepts: acceptsFor(DAY_PASS.price),
      description: `Gallery 402 — day pass: every wing, one payment.`,
      mimeType: 'application/json',
      serviceName: MUSEUM.name,
      unpaidResponseBody: () => ({
        contentType: 'application/json',
        body: { error: 'payment_required', wing: '*', price: DAY_PASS.price, hint: `Pay ${DAY_PASS.price} over x402 for a day pass to every wing.` },
      }),
    },
  ],
])

// ─── app ──────────────────────────────────────────────────────────────────

const app = new Hono()

app.use(
  '*',
  cors({
    origin: (origin) => (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin) ? origin || '*' : ''),
    allowHeaders: ['Content-Type', 'Authorization', 'PAYMENT-SIGNATURE', 'X-PAYMENT', 'Accept'],
    exposeHeaders: ['PAYMENT-REQUIRED', 'PAYMENT-RESPONSE', 'X-PAYMENT-RESPONSE'],
    maxAge: 600,
  }),
)

app.get('/health', (c) => c.json({ ok: true, networks: NETWORKS.map((n) => n.network), mode: MOCK ? 'mock' : 'live' }))

app.get('/', (c) =>
  c.json({
    ...MUSEUM,
    network: NETWORK,
    payTo: PAY_TO,
    facilitator: FACILITATOR_URL,
    networks: NETWORKS,
    wings: WINGS.map(publicWing),
    tours: TOURS.map((t) => ({ ...t, wings: [...new Set(t.stops.map((s) => ARTWORKS.find((a) => a.id === s.artwork)?.wing).filter(Boolean))] })),
    dayPass: { ...DAY_PASS, endpoint: `/tickets/${DAY_PASS.id}` },
    endpoints: {
      wings: '/wings',
      ticket: '/tickets/{wing}',
      artworks: '/wings/{wing}/artworks (Authorization: Ticket <ticket>)',
      faucet: faucet ? '/faucet' : null,
      agent: env.ANTHROPIC_API_KEY ? 'enabled' : 'disabled',
      docent: env.ANTHROPIC_API_KEY ? 'enabled' : 'disabled',
      settlements: '/settlements',
    },
    mode: MOCK ? 'mock' : 'live',
  }),
)

app.get('/wings', (c) => c.json({ wings: WINGS.map(publicWing), dayPass: DAY_PASS }))
app.get('/tours', (c) => c.json({ tours: TOURS }))

// ─── x402 discovery (agents that never open the page) ─────────────────────

const USDC_NAME: Record<string, string> = { 'eip155:84532': 'USDC', 'eip155:8453': 'USD Coin' }
const requirementsFor = (price: string) =>
  acceptsFor(price).map((a) => ({
    scheme: 'exact',
    network: a.network,
    asset: USDC[a.network],
    amount: String(Math.round(parseFloat(price.replace('$', '')) * 1_000_000)),
    payTo: a.payTo,
    maxTimeoutSeconds: 300,
    extra: { name: USDC_NAME[a.network] ?? 'USDC', version: '2' },
  }))

const discovery = (c: any) => {
  const base = new URL(c.req.url).origin
  const now = Math.floor(Date.now() / 1000)
  const items = [
    ...WINGS.map((w) => ({
      resource: `${base}/tickets/${w.id}`,
      type: 'http',
      x402Version: 2,
      accepts: requirementsFor(w.price),
      lastUpdated: now,
      metadata: { category: 'culture', provider: MUSEUM.name, description: `Ticket to the ${w.name} (${w.price}) — ${w.tagline} Returns a signed ticket; send it as Authorization: Ticket <ticket> to GET /wings/${w.id}/artworks.` },
    })),
    {
      resource: `${base}/tickets/${DAY_PASS.id}`,
      type: 'http',
      x402Version: 2,
      accepts: requirementsFor(DAY_PASS.price),
      lastUpdated: now,
      metadata: { category: 'culture', provider: MUSEUM.name, description: `Day pass (${DAY_PASS.price}) — every wing, one payment.` },
    },
  ]
  return c.json({ x402Version: 2, items, pagination: { limit: 20, offset: 0, total: items.length } })
}
app.get('/.well-known/x402', discovery)
app.get('/discovery/resources', discovery)

// ─── settlements ledger (the lobby ticker) ────────────────────────────────

type Settlement = { at: number; wing: string; wingName: string; price: string; payer: string; txHash: string; explorer: string; network: string }
const settlements: Settlement[] = []
const recordSettlement = (s: Settlement) => {
  settlements.unshift(s)
  if (settlements.length > 200) settlements.length = 200
}

app.get('/settlements', (c) => {
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000
  return c.json({
    settlements: settlements.slice(0, 20).map((s) => ({ ...s, payer: `${s.payer.slice(0, 6)}…${s.payer.slice(-4)}` })),
    total: settlements.length,
    last24h: settlements.filter((s) => s.at > dayAgo).length,
    mock: MOCK || undefined,
  })
})

// Wraps the payment middleware: after it settles and stamps PAYMENT-RESPONSE
// on a 200, remember who was admitted where.
app.use('/tickets/*', async (c, next) => {
  await next()
  if (c.res.status !== 200) return
  const h = c.res.headers.get('PAYMENT-RESPONSE') ?? c.res.headers.get('X-PAYMENT-RESPONSE')
  if (!h) return
  try {
    const r = decodePaymentResponseHeader(h)
    if (!r.success) return
    const id = c.req.path.split('/').pop() ?? ''
    const wing = WINGS.find((w) => w.id === id)
    recordSettlement({
      at: Date.now(),
      wing: wing ? wing.id : '*',
      wingName: wing ? wing.name : DAY_PASS.name,
      price: wing ? wing.price : DAY_PASS.price,
      payer: (r.payer ?? payerFromRequest(c.req.header('payment-signature') ?? c.req.header('x-payment'))).toLowerCase(),
      txHash: r.transaction,
      explorer: `${EXPLORER[r.network] ?? EXPLORER[NETWORK]}/tx/${r.transaction}`,
      network: r.network,
    })
  } catch {}
})

// Paid routes. The middleware answers 402 with PAYMENT-REQUIRED, verifies the
// PAYMENT-SIGNATURE on retry, runs the handler, then settles and attaches
// PAYMENT-RESPONSE (settlement tx) to the response.
app.use(MOCK ? mockPaymentMiddleware(routes) : paymentMiddleware(routes, x402))

app.get('/tickets/:wing', (c) => {
  const id = c.req.param('wing')
  const wing = id === DAY_PASS.id ? null : WINGS.find((w) => w.id === id)
  if (id !== DAY_PASS.id && !wing) return c.json({ error: 'unknown_wing', wings: WINGS.map((w) => w.id) }, 404)

  const payer = payerFromRequest(c.req.header('payment-signature') ?? c.req.header('x-payment'))
  const now = Math.floor(Date.now() / 1000)
  const claims: TicketClaims = { w: wing ? wing.id : '*', p: payer, iat: now, exp: now + TICKET_TTL_S }
  const ticket = issueTicket(claims, TICKET_SECRET)
  return c.json({
    ticket,
    wing: wing ? wing.id : '*',
    wingName: wing ? wing.name : DAY_PASS.name,
    payer,
    price: wing ? wing.price : DAY_PASS.price,
    expiresAt: new Date(claims.exp * 1000).toISOString(),
    next: wing ? `/wings/${wing.id}/artworks` : '/wings/{wing}/artworks',
  })
})

app.get('/wings/:wing/artworks', (c) => {
  const wing = WINGS.find((w) => w.id === c.req.param('wing'))
  if (!wing) return c.json({ error: 'unknown_wing' }, 404)
  const ticket = bearerTicket(c.req.header('authorization')) ?? c.req.query('ticket')
  const claims = verifyTicket(ticket, TICKET_SECRET)
  if (!admits(claims, wing.id)) {
    return c.json(
      { error: 'ticket_required', wing: wing.id, price: wing.price, buy: `/tickets/${wing.id}`, hint: 'Buy a ticket over x402, then send it as `Authorization: Ticket <ticket>`.' },
      401,
    )
  }
  const works = ARTWORKS.filter((a) => a.wing === wing.id).map((a) => fullArtwork(a, ticket!))
  return c.json({ wing: publicWing(wing), ticket: { payer: claims!.p, expiresAt: new Date(claims!.exp * 1000).toISOString() }, artworks: works })
})

app.get('/art/:file', async (c) => {
  const file = c.req.param('file')
  const art = ARTWORKS.find((a) => a.file === file)
  if (!art) return c.text('not found', 404)
  const claims = verifyTicket(c.req.query('ticket') ?? bearerTicket(c.req.header('authorization')), TICKET_SECRET)
  if (!admits(claims, art.wing)) return c.json({ error: 'ticket_required', wing: art.wing, buy: `/tickets/${art.wing}` }, 401)
  const p = path.join(ART_DIR, path.basename(file))
  try {
    await stat(p)
  } catch {
    return c.text('missing artwork file', 404)
  }
  const bytes = await readFile(p)
  return c.body(bytes, 200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=3600' })
})

// ─── faucet (testnet drip) ────────────────────────────────────────────────

const faucet = createFaucet({
  privateKey: env.TREASURY_PRIVATE_KEY as `0x${string}` | undefined,
  rpcUrl: env.RPC_URL,
  network: NETWORK,
  amountUsdc: env.FAUCET_AMOUNT_USDC ?? '0.05',
})

app.post('/faucet', async (c) => {
  // Mock mode means no chain at all — including the faucet.
  if (MOCK) return c.json({ ok: true, txHash: `0xmock${randomBytes(28).toString('hex')}`, explorer: '#mock', amount: env.FAUCET_AMOUNT_USDC ?? '0.05', mock: true })
  if (!faucet) return c.json({ error: 'faucet_disabled', hint: 'Fund the wallet from https://faucet.circle.com (Base Sepolia USDC).' }, 503)
  let body: { address?: string } = {}
  try {
    body = await c.req.json()
  } catch {}
  const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'
  const result = await faucet.drip(body.address ?? '', ip)
  return c.json(result, result.ok ? 200 : result.status ?? 400)
})

// ─── static bits (social card) ────────────────────────────────────────────

app.get('/og.png', async (c) => {
  try {
    const bytes = await readFile(path.join(PUBLIC_DIR, 'og.png'))
    return c.body(bytes, 200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' })
  } catch {
    return c.text('not found', 404)
  }
})

// ─── the docent (vision) ──────────────────────────────────────────────────

const docent = createDocent({ apiKey: env.ANTHROPIC_API_KEY, artDir: ART_DIR, model: env.DOCENT_MODEL })

app.post('/docent', async (c) => {
  if (!docent) return c.json({ error: 'docent_disabled', hint: 'Set ANTHROPIC_API_KEY on the box office to enable the docent.' }, 503)
  let body: { artworkId?: string; x?: number; y?: number; question?: string; ticket?: string } = {}
  try {
    body = await c.req.json()
  } catch {}
  const art = ARTWORKS.find((a) => a.id === body.artworkId)
  if (!art) return c.json({ error: 'unknown_artwork' }, 404)
  const claims = verifyTicket(bearerTicket(c.req.header('authorization')) ?? body.ticket, TICKET_SECRET)
  if (!admits(claims, art.wing)) return c.json({ error: 'ticket_required', wing: art.wing, buy: `/tickets/${art.wing}` }, 401)
  const x = Number(body.x), y = Number(body.y)
  if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) return c.json({ error: 'bad_point', hint: 'x and y are fractions of the image, 0–1.' }, 400)
  const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'
  try {
    const r = await docent.ask(art, x, y, body.question, ip)
    if ('error' in r) return c.json({ error: r.error }, r.status)
    return c.json({ artwork: art.id, ...r })
  } catch (err: any) {
    console.error('[docent]', err?.message ?? err)
    return c.json({ error: 'docent_error', hint: String(err?.message ?? err).slice(0, 200) }, 502)
  }
})

// ─── optional in-page agent proxy ─────────────────────────────────────────

app.post('/agent', async (c) => {
  const key = env.ANTHROPIC_API_KEY
  if (!key) return c.json({ error: 'agent_disabled', hint: 'Set ANTHROPIC_API_KEY on the box office to enable the in-page agent.' }, 503)
  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: await c.req.text(),
  })
  return new Response(upstream.body, { status: upstream.status, headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' } })
})

// ─── helpers ──────────────────────────────────────────────────────────────

/**
 * Stand-in for the x402 middleware when X402_MODE=mock: same headers, same
 * status codes, no facilitator, no chain. Lets the gallery's full client path
 * (402 → quote → policy → sign → retry → receipt) run in CI and evals.
 */
function mockPaymentMiddleware(routeMap: RoutesConfig): MiddlewareHandler {
  const map = routeMap as Record<string, { accepts: any; description?: string; mimeType?: string }>
  return async (c, next) => {
    const route = map[`${c.req.method} ${c.req.path}`]
    if (!route) return next()
    const accept = Array.isArray(route.accepts) ? route.accepts[0] : route.accepts
    const sig = c.req.header('payment-signature') ?? c.req.header('x-payment')
    const amount = String(Math.round(parseFloat(String(accept.price).replace('$', '')) * 1_000_000))
    if (!sig) {
      const required = {
        x402Version: 2,
        error: 'Payment required',
        resource: { url: c.req.url, description: route.description, mimeType: route.mimeType },
        accepts: [{ scheme: 'exact', network: accept.network, asset: USDC[accept.network] ?? USDC[NETWORK], amount, payTo: accept.payTo, maxTimeoutSeconds: 300, extra: { name: 'USDC', version: '2' } }],
      }
      c.header('PAYMENT-REQUIRED', encodePaymentRequiredHeader(required as any))
      return c.json({ error: 'payment_required', mock: true }, 402)
    }
    await next()
    if (c.res.status === 200) {
      c.res.headers.set(
        'PAYMENT-RESPONSE',
        encodePaymentResponseHeader({ success: true, transaction: `0xmock${randomBytes(28).toString('hex')}`, network: accept.network, payer: payerFromRequest(sig) }),
      )
    }
  }
}

function publicWing(w: Wing) {
  return {
    id: w.id,
    name: w.name,
    tagline: w.tagline,
    price: w.price,
    endpoint: `/tickets/${w.id}`,
    artworkCount: ARTWORKS.filter((a) => a.wing === w.id).length,
    teasers: ARTWORKS.filter((a) => a.wing === w.id).map((a) => ({
      id: a.id, title: a.title, artist: a.artist, date: a.date,
      // Dimensions are public catalogue data, not something you buy — and knowing
      // a room is six small prints is exactly what helps you pick a door.
      size: `${a.heightCm} × ${a.widthCm} cm`,
      teaser: `teasers/${a.file}`,
    })),
  }
}

function fullArtwork(a: Artwork, ticket: string) {
  return {
    id: a.id,
    title: a.title,
    artist: a.artist,
    date: a.date,
    medium: a.medium,
    widthCm: a.widthCm,
    heightCm: a.heightCm,
    size: `${a.heightCm} × ${a.widthCm} cm`,
    museum: a.museum,
    credit: a.credit,
    sourceUrl: a.sourceUrl,
    note: a.note,
    image: `/art/${a.file}?ticket=${encodeURIComponent(ticket)}`,
  }
}

function bearerTicket(header: string | undefined): string | undefined {
  if (!header) return undefined
  const m = /^(?:Ticket|Bearer)\s+(.+)$/i.exec(header.trim())
  return m?.[1]
}

/** Pull the paying wallet out of the x402 payment header so the ticket is bound to it. */
function payerFromRequest(header: string | undefined): string {
  if (!header) return 'anon'
  try {
    const payload = decodePaymentSignatureHeader(header) as { payload?: Record<string, unknown> }
    const inner = payload.payload ?? {}
    const auth = inner.authorization as { from?: string } | undefined
    const permit = inner.permit2Authorization as { owner?: string } | undefined
    const from = auth?.from ?? permit?.owner
    return typeof from === 'string' ? from.toLowerCase() : 'anon'
  } catch {
    return 'anon'
  }
}

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[box-office] ${MUSEUM.name} open at http://localhost:${info.port}`)
  for (const n of NETWORKS) console.log(`[box-office]   accepts ${n.label} (${n.network}) → ${n.payTo} via ${n.facilitator}`)
  console.log(`[box-office] faucet ${faucet ? 'enabled' : 'disabled (set TREASURY_PRIVATE_KEY)'} · agent proxy + docent ${env.ANTHROPIC_API_KEY ? 'enabled' : 'disabled (set ANTHROPIC_API_KEY)'}${MOCK ? ' · X402_MODE=mock (no chain, no facilitator)' : ''}`)
})

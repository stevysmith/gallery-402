/**
 * Tickets — short signed tokens the box office hands out after an x402
 * payment settles. A ticket says "wallet P may enter wing W until T".
 *
 * Format: base64url(JSON payload) + "." + hex(HMAC-SHA256(payload))
 * Deliberately tiny and dependency-free so the gallery can show it to the
 * visitor and their agent can carry it between tool calls.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

export type TicketClaims = {
  /** wing id, or "*" for a day pass */
  w: string
  /** payer wallet address (lower-cased) or "anon" when the rail didn't tell us */
  p: string
  /** issued-at (unix seconds) */
  iat: number
  /** expiry (unix seconds) */
  exp: number
  /** settlement tx hash, when known at issue time */
  tx?: string
}

const b64u = (buf: Buffer | string) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64u = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')

export function issueTicket(claims: TicketClaims, secret: string): string {
  const body = b64u(JSON.stringify(claims))
  const sig = createHmac('sha256', secret).update(body).digest('hex').slice(0, 32)
  return `${body}.${sig}`
}

export function verifyTicket(ticket: string | undefined | null, secret: string): TicketClaims | null {
  if (!ticket) return null
  const [body, sig] = ticket.split('.')
  if (!body || !sig) return null
  const expect = createHmac('sha256', secret).update(body).digest('hex').slice(0, 32)
  if (sig.length !== expect.length) return null
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null
  try {
    const claims = JSON.parse(unb64u(body).toString('utf8')) as TicketClaims
    if (typeof claims.exp !== 'number' || claims.exp * 1000 < Date.now()) return null
    return claims
  } catch {
    return null
  }
}

/** Does this ticket admit the holder to the given wing? */
export function admits(claims: TicketClaims | null, wing: string): boolean {
  return !!claims && (claims.w === '*' || claims.w === wing)
}

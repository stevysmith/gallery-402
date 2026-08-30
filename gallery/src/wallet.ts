/**
 * The visitor's wallet — a small, self-custodied key that lives in this
 * browser (localStorage) so the demo works in ChatGPT's in-app browser and in
 * Chrome with no extension. Pays x402 invoices in USDC on Base Sepolia.
 *
 * The 402 dance is done by hand (rather than `wrapFetchWithPayment`) so the
 * page can show the visitor a quote, apply their spending policy, and record
 * a receipt for every step:
 *
 *   fetch → 402 + PAYMENT-REQUIRED → quote → policy/confirm → sign (EIP-3009)
 *         → retry with PAYMENT-SIGNATURE → 200 + PAYMENT-RESPONSE (tx hash)
 */
import { createPublicClient, http, erc20Abi, formatUnits } from 'viem'
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'
import { x402Client, type PaymentRequired, type PaymentRequirements } from '@x402/fetch'
import { decodePaymentRequiredHeader, encodePaymentSignatureHeader, decodePaymentResponseHeader } from '@x402/core/http'
import { ExactEvmScheme } from '@x402/evm/exact/client'

export const NETWORK = 'eip155:84532' as const
export const USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const
export const EXPLORER = 'https://sepolia.basescan.org'

const KEY = 'g402.visitorKey'
const POLICY_KEY = 'g402.policy'

export type SpendPolicy = {
  /** payments at or below this (USD) go through without asking */
  autoApproveUpToUsd: number
  /** if true, every payment asks the human first */
  askEveryTime: boolean
}
export const DEFAULT_POLICY: SpendPolicy = { autoApproveUpToUsd: 0.05, askEveryTime: false }

export type PaymentQuote = {
  url: string
  amountUsd: number
  amountAtomic: string
  asset: string
  payTo: string
  network: string
  description: string
  resource: string
}
export type PaymentReceipt = {
  url: string
  description: string
  amountUsd: number
  txHash: string
  explorer: string
  network: string
  payer: string
  at: number
}
export type PaymentEvent =
  | { type: 'request'; url: string }
  | { type: 'quote'; quote: PaymentQuote }
  | { type: 'policy'; decision: 'auto' | 'ask'; quote: PaymentQuote }
  | { type: 'approved'; quote: PaymentQuote }
  | { type: 'declined'; quote: PaymentQuote }
  | { type: 'signed'; quote: PaymentQuote }
  | { type: 'settled'; receipt: PaymentReceipt }
  | { type: 'error'; message: string }

export class PaymentDeclined extends Error {
  constructor(public quote: PaymentQuote) {
    super(`Payment of $${quote.amountUsd.toFixed(3)} declined by the visitor`)
  }
}

function safeGet(k: string): string | null {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
function safeSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v)
  } catch {}
}

export function loadPolicy(): SpendPolicy {
  try {
    const raw = safeGet(POLICY_KEY)
    if (raw) return { ...DEFAULT_POLICY, ...JSON.parse(raw) }
  } catch {}
  return DEFAULT_POLICY
}
export function savePolicy(p: SpendPolicy) {
  safeSet(POLICY_KEY, JSON.stringify(p))
}

export class VisitorWallet {
  readonly account: PrivateKeyAccount
  readonly address: `0x${string}`
  private client: x402Client
  private pub = createPublicClient({ chain: baseSepolia, transport: http() })

  constructor(privateKey?: `0x${string}`) {
    let pk = privateKey ?? (safeGet(KEY) as `0x${string}` | null)
    if (!pk) {
      pk = generatePrivateKey()
      safeSet(KEY, pk)
    }
    this.account = privateKeyToAccount(pk)
    this.address = this.account.address
    // Prefer our network when the server offers several; let the SDK do the
    // EIP-3009 typed-data signing.
    this.client = new x402Client((_v, reqs) => reqs.find((r) => r.network === NETWORK && r.scheme === 'exact') ?? reqs[0])
      .register(NETWORK, new ExactEvmScheme(this.account))
      .setSpendControls({ maxAmountPerPayment: '$1' })
  }

  /** Throw the key away and start again (a new visitor). */
  static reset() {
    try {
      localStorage.removeItem(KEY)
    } catch {}
  }

  async balance(): Promise<{ usdc: number; formatted: string }> {
    const raw = (await this.pub.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [this.address] })) as bigint
    return { usdc: Number(formatUnits(raw, 6)), formatted: formatUnits(raw, 6) }
  }

  /**
   * fetch() that pays when asked. `confirm` is called when the policy says a
   * human must approve; `onEvent` gets the whole timeline for the UI.
   */
  async payFetch(
    url: string,
    init: RequestInit = {},
    opts: { policy: SpendPolicy; confirm: (q: PaymentQuote) => Promise<boolean>; onEvent?: (e: PaymentEvent) => void } ,
  ): Promise<{ response: Response; receipt?: PaymentReceipt }> {
    const emit = (e: PaymentEvent) => opts.onEvent?.(e)
    emit({ type: 'request', url })
    const first = await fetch(url, init)
    if (first.status !== 402) return { response: first }

    const header = first.headers.get('PAYMENT-REQUIRED')
    let required: PaymentRequired
    if (header) required = decodePaymentRequiredHeader(header)
    else {
      // v1-style body fallback
      const body = await first.clone().json().catch(() => null)
      if (!body?.accepts) {
        emit({ type: 'error', message: 'Server said 402 but sent no payment requirements' })
        return { response: first }
      }
      required = body as PaymentRequired
    }
    const req = pick(required.accepts)
    if (!req) {
      emit({ type: 'error', message: `No acceptable payment option for ${NETWORK}` })
      return { response: first }
    }
    const quote = toQuote(url, required, req)
    emit({ type: 'quote', quote })

    const needsHuman = opts.policy.askEveryTime || quote.amountUsd > opts.policy.autoApproveUpToUsd
    emit({ type: 'policy', decision: needsHuman ? 'ask' : 'auto', quote })
    if (needsHuman) {
      const ok = await opts.confirm(quote)
      if (!ok) {
        emit({ type: 'declined', quote })
        throw new PaymentDeclined(quote)
      }
    }
    emit({ type: 'approved', quote })

    const payload = await this.client.createPaymentPayload(required)
    emit({ type: 'signed', quote })
    const headers = new Headers(init.headers ?? {})
    headers.set('PAYMENT-SIGNATURE', encodePaymentSignatureHeader(payload))
    const paid = await fetch(url, { ...init, headers })

    const respHeader = paid.headers.get('PAYMENT-RESPONSE') ?? paid.headers.get('X-PAYMENT-RESPONSE')
    let receipt: PaymentReceipt | undefined
    if (paid.ok && respHeader) {
      try {
        const settle = decodePaymentResponseHeader(respHeader)
        receipt = {
          url,
          description: quote.description,
          amountUsd: quote.amountUsd,
          txHash: settle.transaction,
          explorer: `${EXPLORER}/tx/${settle.transaction}`,
          network: settle.network,
          payer: settle.payer ?? this.address,
          at: Date.now(),
        }
        emit({ type: 'settled', receipt })
      } catch (e: any) {
        emit({ type: 'error', message: `Paid, but could not read the settlement receipt: ${e?.message ?? e}` })
      }
    } else if (!paid.ok && paid.status !== 402) {
      const text = await paid.clone().text().catch(() => '')
      emit({ type: 'error', message: `Payment rejected (${paid.status}): ${text.slice(0, 200)}` })
    }
    return { response: paid, receipt }
  }
}

function pick(accepts: PaymentRequirements[]): PaymentRequirements | undefined {
  return accepts.find((r) => r.network === NETWORK && r.scheme === 'exact') ?? accepts[0]
}

function toQuote(url: string, required: PaymentRequired, req: PaymentRequirements): PaymentQuote {
  const decimals = Number((req.extra as any)?.decimals ?? 6)
  return {
    url,
    amountUsd: Number(req.amount) / 10 ** decimals,
    amountAtomic: req.amount,
    asset: req.asset,
    payTo: req.payTo,
    network: req.network,
    description: required.resource?.description ?? 'Payment',
    resource: required.resource?.url ?? url,
  }
}

export const short = (addr: string) => (addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '')

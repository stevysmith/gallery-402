/**
 * Testnet drip. Visitors arrive with an empty in-page wallet; their agent
 * calls `fund_wallet`, which hits this endpoint, and the treasury sends a few
 * cents of Base Sepolia USDC so the x402 flow can be exercised for real.
 * Rate-limited per address and per IP. Disabled unless TREASURY_PRIVATE_KEY is set.
 */
import { createPublicClient, createWalletClient, http, isAddress, parseUnits, formatUnits, erc20Abi, type Chain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base, baseSepolia } from 'viem/chains'

const USDC: Record<string, `0x${string}`> = {
  'eip155:84532': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  'eip155:8453': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
}
const CHAINS: Record<string, Chain> = { 'eip155:84532': baseSepolia, 'eip155:8453': base }
const EXPLORER: Record<string, string> = { 'eip155:84532': 'https://sepolia.basescan.org', 'eip155:8453': 'https://basescan.org' }

type DripResult =
  | { ok: true; txHash: string; explorer: string; amount: string; balanceBefore: string }
  | { ok: false; status?: 400 | 429 | 503; error: string; hint?: string }

export function createFaucet(opts: { privateKey?: `0x${string}`; rpcUrl?: string; network: string; amountUsdc: string }) {
  const chain = CHAINS[opts.network]
  const usdc = USDC[opts.network]
  if (!opts.privateKey || !chain || !usdc) return null
  if (opts.network === 'eip155:8453') {
    console.warn('[faucet] refusing to run a drip on Base mainnet')
    return null
  }

  const account = privateKeyToAccount(opts.privateKey)
  const transport = http(opts.rpcUrl)
  const pub = createPublicClient({ chain, transport })
  const wallet = createWalletClient({ account, chain, transport })
  const amount = parseUnits(opts.amountUsdc, 6)
  const DAY = 24 * 60 * 60 * 1000
  const lastByAddress = new Map<string, number>()
  const countByIp = new Map<string, { n: number; since: number }>()

  console.log(`[faucet] treasury ${account.address} drips ${opts.amountUsdc} USDC on ${chain.name}`)

  return {
    address: account.address,
    async drip(to: string, ip: string): Promise<DripResult> {
      if (!isAddress(to)) return { ok: false, status: 400, error: 'invalid_address' }
      const key = to.toLowerCase()
      const now = Date.now()
      const last = lastByAddress.get(key)
      if (last && now - last < DAY) return { ok: false, status: 429, error: 'already_funded_today', hint: 'Each wallet can be topped up once per day.' }
      const ipRec = countByIp.get(ip) ?? { n: 0, since: now }
      if (now - ipRec.since > DAY) Object.assign(ipRec, { n: 0, since: now })
      // Generous: judges may share one NAT, and each drip is a few cents of testnet money.
      if (ipRec.n >= 200) return { ok: false, status: 429, error: 'ip_limit', hint: 'Too many wallets funded from this network today.' }

      const balance = (await pub.readContract({ address: usdc, abi: erc20Abi, functionName: 'balanceOf', args: [to] })) as bigint
      if (balance >= amount) return { ok: false, status: 400, error: 'already_funded', hint: `Wallet already holds ${formatUnits(balance, 6)} USDC.` }

      const treasury = (await pub.readContract({ address: usdc, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] })) as bigint
      if (treasury < amount) return { ok: false, status: 503, error: 'treasury_empty', hint: `Treasury ${account.address} needs USDC from https://faucet.circle.com` }

      try {
        const txHash = await wallet.writeContract({ address: usdc, abi: erc20Abi, functionName: 'transfer', args: [to, amount] })
        lastByAddress.set(key, now)
        ipRec.n += 1
        countByIp.set(ip, ipRec)
        return { ok: true, txHash, explorer: `${EXPLORER[opts.network]}/tx/${txHash}`, amount: opts.amountUsdc, balanceBefore: formatUnits(balance, 6) }
      } catch (err: any) {
        const msg = String(err?.shortMessage ?? err?.message ?? err)
        const gas = /insufficient funds|gas/i.test(msg)
        return { ok: false, status: 503, error: 'drip_failed', hint: gas ? `Treasury ${account.address} needs a little Base Sepolia ETH for gas.` : msg.slice(0, 200) }
      }
    },
  }
}

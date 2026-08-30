#!/usr/bin/env node
/**
 * Fund the box-office treasury on Base Sepolia so the visitor faucet works.
 *
 * Two ways:
 *   1. Coinbase Developer Platform faucet (no captcha). Needs CDP_API_KEY_ID and
 *      CDP_API_KEY_SECRET in the environment:
 *        CDP_API_KEY_ID=… CDP_API_KEY_SECRET=… node scripts/fund-treasury.mjs 0xYourTreasury
 *   2. Manually: USDC at https://faucet.circle.com (pick Base Sepolia) and a
 *      little ETH for gas from https://portal.cdp.coinbase.com/products/faucet
 *      or https://www.alchemy.com/faucets/base-sepolia
 *
 * The treasury needs USDC (to drip) AND a few thousandths of ETH (gas for the
 * ERC-20 transfers). Ticket payments themselves are gasless for visitors — the
 * facilitator submits the EIP-3009 authorization.
 */
const address = process.argv[2] ?? process.env.PAY_TO
if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
  console.error('usage: node scripts/fund-treasury.mjs 0xTreasuryAddress')
  process.exit(1)
}
if (!process.env.CDP_API_KEY_ID || !process.env.CDP_API_KEY_SECRET) {
  console.log(`No CDP_API_KEY_ID/CDP_API_KEY_SECRET in the environment.\n` +
    `Fund ${address} manually instead:\n` +
    `  USDC: https://faucet.circle.com  (network: Base Sepolia)\n` +
    `  ETH:  https://portal.cdp.coinbase.com/products/faucet  or  https://www.alchemy.com/faucets/base-sepolia`)
  process.exit(0)
}
let CdpClient
try {
  ;({ CdpClient } = await import('@coinbase/cdp-sdk'))
} catch {
  console.error('Run `npm i @coinbase/cdp-sdk` in the repo root first (it is not a runtime dependency).')
  process.exit(1)
}
const cdp = new CdpClient()
for (const token of ['eth', 'usdc']) {
  try {
    const r = await cdp.evm.requestFaucet({ address, network: 'base-sepolia', token })
    console.log(`${token.toUpperCase()} sent → https://sepolia.basescan.org/tx/${r.transactionHash}`)
  } catch (e) {
    console.error(`${token.toUpperCase()} faucet failed: ${e?.message ?? e}`)
  }
}

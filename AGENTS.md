# Gallery 402 — agent guide

A virtual museum whose doors take x402 micropayments. Two packages, one repo.

## Run it

```bash
# Box office (Hono, port 4402). Mock mode needs no chain, no keys:
cd box-office && npm install --include=dev && X402_MODE=mock npm run dev

# Gallery (Vite, port 5173), in another shell:
cd gallery && npm install && npm run dev
```

`gallery/.env` points at `http://localhost:4402` by default. The deployed pair:
museum https://gallery402.stacktr.ee/ · box office https://gallery-402-box-office.onrender.com (free tier — first hit after idle takes ~30s; the page retries and says so).

## Where things are

- **WebMCP surface** — `gallery/src/tools.ts`. The catalog (22 tools, ~11–17 registered at a time), `useTools()` (which tools exist in which page state), `makeExecutor()` (adds `sinceYourLastCall` + `visitorPointing` to agent results). Registration itself is agentk's `useWebMCPRegistration`, called from `gallery/src/App.tsx`.
- **State & money** — `gallery/src/store.ts` (external store; tours, undo, spend policy), `gallery/src/wallet.ts` (in-page viem wallet, Base Sepolia only, signs EIP-3009), `gallery/src/api.ts` (box-office client; `wakeable()` retries cold starts).
- **Paywall** — `box-office/src/index.ts` (x402 middleware, both rails, proxied-URL normalisation at `fetchBehindProxy`), `tickets.ts` (HMAC tickets), `faucet.ts` (testnet drip), `collection.ts` (24 works, real dimensions), `docent.ts` (vision docent).

## Test it

```bash
cd gallery
npm run typecheck
npm run eval     # 29 scripted agent runs through a fake document.modelContext
npm run compat   # ChatGPT-subset + Chrome budget checks; fails on oversize output
```

`npm test` in the agentk repo covers the palette/registration library (180 tests).

## Rules of the house

- Tools are namespaced `gallery_*` — on Stacktree the host registers its own tools into the same `document.modelContext`, and the agent sees the union.
- Read-only tools carry `readOnlyHint` and are safe to call freely. Tools that spend (`buy_ticket`, `start_tour`, `take_tour`) respect the visitor's spend policy and may open a confirm sheet — never bypass it.
- Tool errors are next-step instructions ("No ticket for the Van Gogh Room ($0.02). Call buy_ticket…"). Trust them; they are the API.
- Never register/unregister tools while a call is in flight (Chrome <153 aborts the call). agentk defers surface changes automatically; keep it that way.
- `X402_MODE=mock` is for local work and evals only. The deployed box office runs live rails; testnet is listed first in every 402 so unfunded agents take the free path.

## Gotchas that cost us time

- After re-vendoring or upgrading agentk: `rm -rf node_modules/.vite`, or Vite serves the stale pre-bundle.
- `pkill -f box-office` matches nothing (the process is `node --import tsx src/index.ts`); use `lsof -ti :4402 | xargs kill`.
- ChatGPT's browser exposes **only** `document.modelContext`, requires **object** input to `executeTool`, and needs Work mode + a Sol/Terra model + a per-site permission prompt. Details: `CHATGPT-TESTING.md`.

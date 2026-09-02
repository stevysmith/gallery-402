# Gallery 402 — Payment Required

A virtual museum where **you look at the paintings and your agent buys the tickets.**

Each wing costs a few cents, charged over **HTTP 402** using the [x402](https://x402.org) protocol (USDC on Base Sepolia). The page exposes its box office as **WebMCP tools** (`document.modelContext.registerTool`), so an agent in your browser — ChatGPT's in-app browser, or Chrome with WebMCP enabled — can quote, pay and walk you into a room while you stay on the page. The human sets a spending policy; the agent operates inside it.

Built for [The WebMCP Challenge](https://webmcp.devpost.com/) (Aug 25 – Sep 3, 2026).

- **Live:** _(coming — see [Deploy](#deploy))_
- **Video:** _(coming)_
- **License:** MIT
- **Where the WebMCP code is:** the tool catalog and executor are [`gallery/src/tools.ts`](gallery/src/tools.ts); registration goes through agentk's [`useWebMCPRegistration`](https://github.com/stevysmith/agentk/blob/main/src/index.tsx) (`document.modelContext.registerTool`, `navigator.modelContext` fallback, `AbortSignal` unregistration) from [`gallery/src/App.tsx`](gallery/src/App.tsx); the evals that exercise it are in [`gallery/evals/`](gallery/evals/).

---

## What happens when an agent says "get me into the Van Gogh room"

```
agent ──► gallery_list_wings ──────────────► { van-gogh: $0.02, ticket: needed, … }
agent ──► gallery_buy_ticket({wing:"van-gogh"})
             page: GET /tickets/van-gogh ──► 402 + PAYMENT-REQUIRED (x402 v2)
             page: quote $0.02 → visitor's policy (auto ≤ $0.05, or ask) → sign EIP-3009 (no gas, no popup)
             page: GET /tickets/van-gogh + PAYMENT-SIGNATURE ──► facilitator verifies + settles on Base Sepolia
             page: 200 + PAYMENT-RESPONSE (tx hash) + a signed ticket bound to the paying wallet
          ◄── { ticket, settlement: { txHash, explorer } }
agent ──► gallery_enter_wing({wing:"van-gogh"}) ──► the wall turns ochre, The Bedroom is on it
agent ──► gallery_walk({direction:"next"}) / gallery_view_artwork({query:"Irises"}) …
```

Every step prints in the on-page **ledger**, and every settled payment prints a **ticket stub** with its transaction hash.

## The tools

One catalog drives both the human ⌘K palette and WebMCP registration (via [agentk](https://github.com/stevysmith/agentk)'s `useWebMCPRegistration`). Registered with the `gallery_` prefix:

| tool | what it does | annotations |
|---|---|---|
| `list_wings` | wings, prices, what hangs where, which tickets you hold | `readOnlyHint` |
| `list_artworks` | titles, artists and dates in one wing or across the museum — stops for `plan_tour`, a target for `view_artwork` | `readOnlyHint` |
| `look_around` | what's on screen: room, artwork, curator note, neighbours | `readOnlyHint` |
| `wallet_status` | address, USDC balance, spending policy, tickets, receipts | `readOnlyHint` |
| `fund_wallet` | testnet drip so the demo can be exercised for real | |
| `buy_ticket` | pays a wing (or the day pass) over x402 inside the visitor's policy | |
| `enter_wing` | walks into a ticketed wing | |
| `present_ticket` | hand over a ticket bought directly from the box office's 402 by an agent with its own wallet — honoured like one bought in-page | |
| `view_artwork` | brings a work in front of the visitor by title / artist / id | |
| `walk` | next / previous along the wall | |
| `undo` | take back the last move, spotlight or tour edit — payments stay paid, and it says so | |
| `receipts` | every payment and ticket, with tx links | `readOnlyHint` |
| `whos_here` | who was admitted recently, with settlement txs (the lobby ticker) | `readOnlyHint` |
| `go_to_lobby` | back to the entrance hall | |
| **`plan_tour`** | propose a guided tour: theme + ordered stops with docent notes and optional spotlight regions; prices the doors; the visitor can reorder/drop stops | |
| **`start_tour`** | buys the cheapest doors the tour needs (tickets vs day pass) within the visitor's policy, walks to stop 1 | |
| **`tour_step`** | next/previous stop — shows the work, applies its spotlight and note | |
| **`end_tour`** | close the itinerary | |
| **`spotlight`** | zoom into a region of the work on the wall and leave a docent note as wall text | |
| **`compare`** | hang two works side by side | |
| **`take_tour`** | load one of the museum's own curated tours by id | |
| **`save_tour`** | publish the tour — works, notes, what admission cost — as a keepsake page | |
| **`ask_docent`** | ask the museum's own docent (a vision model on the box office) what is at the spot the visitor pointed at — appears once they've clicked | |

**Nobody hits a dead end.** Three tours written by the museum sit on the lobby floor, one click each — a visitor with no agent at all gets the guided experience. The wallet is staked a few cents of test USDC on arrival, and a purchase that still finds it empty tops up and retries once, so the first click can't fail. `start_tour` buys the cheapest set of doors the route needs — three single tickets or a day pass, whichever is less. At the end, **save the tour**: its works, the docent's notes and what admission cost are published as a standalone page on [Stacktree](https://stacktr.ee) that the visitor keeps.

**The docent layer — human and agent on the same wall.** `plan_tour` turns the agent into a guide: it composes stops with its own notes into a shared itinerary the visitor can reorder or drop; `start_tour` pays for exactly the doors the route needs (choosing a day pass when that's cheaper); `spotlight` dims everything but a detail and shows the note beside the label; `compare` hangs two works together. It runs the other way too: the visitor *clicks a spot on the painting* and `look_around` reports `visitorPointing` — so "what's that?" just works. WebMCP is agent-initiated (a page can't push to the agent), so the page also has a docent of its own: with `ANTHROPIC_API_KEY` on the box office, the click itself asks `POST /docent`, which shows Claude the actual painting and the click position and returns an answer plus a region — spotlight and wall text, no button. A WebMCP agent can call the same thing via `ask_docent` for a second opinion.

**The in-page agent works in steps.** Type a request in ⌘K — *"give me a short tour about light and then start it and walk me to the second stop"* — and it runs to completion: `take_tour` → `start_tour` (which buys the day pass) → `tour_step`, then a plain-English summary of where you are. Each plan is approved by a human first, except read-only ones, which run freely (`autoApproveReadOnly` reads the WebMCP `readOnlyHint` annotations). That needed agentk 0.6.x — before it, the agent planned once, ran one tool, and stopped.

**A Chrome-version trap, found the hard way.** Before Chrome 153, unregistering a tool aborts an execution still running on it (`UnknownError: transient`). A live surface trips this constantly — `buy_ticket`'s own result makes `enter_wing` appear. agentk 0.5.1 therefore defers every surface change until the last in-flight call has returned and the browser has delivered its result; the eval harness's fake `modelContext` records any register/unregister during a call as a failure so it can't regress. Verified end-to-end against Chrome 151's real `document.modelContext`.

**The page can't speak first, so it speaks next.** WebMCP is agent-initiated; the only channel a page has back to the agent is the result of the next tool call. Every result returned to an agent therefore carries `sinceYourLastCall` — what the visitor did in the meantime (pointed at a detail, dropped a tour stop, changed their spending limit) — and, when they're pointing, `visitorPointing`. That is the "back and forth" Chrome's tool-design guide describes, done on purpose. The wing is one long wall the camera glides along; neighbouring works hang at an angle either side.

**The surface is visible — to the human, with prices.** Click the WebMCP pill and a panel opens: *what your agent can do, here, now*. It lists the live tools and **animates entries in and out as the page changes** — walk into a room and `walk`, `spotlight` and `go_to_lobby` appear; buy a day pass and `buy_ticket` slides away. The tools that cost money carry their live price: `buy_ticket · $0.01–$0.04`, and `start_tour · $0.04` quoting the doors the *current* itinerary actually still needs. The agent's menu has prices on it. `npm run compat` asserts the panel can't lie — what the human sees must equal what `getTools()` returns.

**The surface is live, not a menu.** `useTools()` narrows the catalog to what makes sense right now and agentk re-registers on change (which fires the browser's `toolchange`): `walk` and `spotlight` only exist inside a wing; `start_tour` only while a tour is proposed and `tour_step` only while one is running; `buy_ticket` only offers wings you don't hold and disappears once you have a day pass; `enter_wing` only lists wings you can enter; `fund_wallet` goes away once the wallet is funded. An agent reading the tool list gets the page's state for free.

Deliberately **not** a tool: changing the spending policy. That's a human control in the wallet panel.

## Evals

Twenty-six cases, two runners, one fake `document.modelContext` that drives the real page the way a WebMCP browser does. `npm run eval` replays each case's expected tool sequence and checks the page (wing, artwork, tickets, which tools are registered afterwards, `isError` on a declined payment). `npm run eval:llm` hands the same prompts to a real model with the live tool list, re-read every turn, and judges what it chose to call — e.g. that "see every room cheaply" buys one day pass, and "what does it cost?" buys nothing. Details in [`gallery/evals/README.md`](gallery/evals/README.md).

```
✓ enter-van-gogh        ✓ price-check-no-purchase   ✓ see-everything-cheaply   ✓ show-great-wave
✓ take-me-to-milkmaid   ✓ next-painting             ✓ balance-question         ✓ top-up
✓ day-pass-then-enter   ✓ what-am-i-looking-at      ✓ policy-ask-approve       ✓ policy-ask-decline
✓ leave-room            ✓ whos-here                 ✓ plan-tour-prices-doors   ✓ start-tour-buys-cheapest
✓ tour-step-applies-spotlight   ✓ tour-crosses-rooms-and-finishes   ✓ visitor-drops-a-stop
✓ spotlight-detail      ✓ visitor-points-agent-reads   ✓ compare-two-works     ✓ compare-needs-tickets
✓ take-curated-tour     ✓ curated-tour-buys-cheapest-doors    ✓ light-tour-prefers-day-pass
26/26 scripted evals passed
```

**It works in ChatGPT, through the tools.** *"Get me into the Van Gogh room"* in Work mode: ChatGPT read the museum, quoted $0.02, noticed the empty wallet, asked to fund and pay, and then called `fund_wallet` → `buy_ticket` → `enter_wing` over `document.modelContext`. The ledger's `agent` rows are the proof it used the tools rather than clicking.

**Tested in ChatGPT's in-app browser.** Not just against the docs — we drove ChatGPT desktop over CDP and watched the museum register 12 tools and grow to 16 as a tour loaded. See [`CHATGPT-TESTING.md`](CHATGPT-TESTING.md) for the method and the two host differences it exposed.

**Checked against ChatGPT's documented subset.** `npm run compat` verifies the page the way ChatGPT's in-app browser will read it — registration on `document.modelContext`, top-level only, no iframes or declarative forms — and enforces Chrome's published budgets for names, descriptions and tool output across several page states. It caught `list_wings` returning 4038 characters on the first call an agent makes; the catalogue now lives in its own `list_artworks`.

## Layout

```
gallery/      the museum — a single self-contained HTML file (Vite + React + agentk + viem + @x402/fetch)
box-office/   Hono service: x402 v2 paywall (@x402/hono), signed tickets, gated artwork, settlements ticker, testnet faucet
gallery/evals/  the eval harness + cases (see above)
scripts/      fund-treasury.mjs — top up the box office on Base Sepolia
```

**Why a single HTML file?** So the museum can be published to [Stacktree](https://stacktr.ee) — or any static host — with one request. Teasers are inlined; the full-resolution collection is only served to ticket holders by the box office.

## Run it locally

```bash
# 1. box office
cd box-office
cp .env.example .env            # set PAY_TO (your receiving wallet), TICKET_SECRET, optionally TREASURY_PRIVATE_KEY
npm install && npm run dev      # http://localhost:4402

# 2. gallery
cd ../gallery
npm install
npm run dev                     # http://localhost:5173 — talks to localhost:4402 (gallery/.env)
```

Open the gallery in **ChatGPT's in-app browser** (site tools are on by default) or in **Chrome** with `chrome://flags/#enable-webmcp-testing` enabled, and ask the agent to get you into a room. The "WebMCP" pill in the top bar turns green when the tools are registered.

No testnet funds yet? Start the box office with `X402_MODE=mock` — it speaks real x402 headers but settles nothing, so you can click through the whole flow (this is what the evals use).

The visitor wallet is a key generated in the browser and kept in `localStorage`. It needs test USDC: press **Top up** (or let the agent call `fund_wallet`) — the box office treasury sends 0.05 USDC. To fund the treasury itself, see `scripts/fund-treasury.mjs` (CDP faucet) or use [faucet.circle.com](https://faucet.circle.com) for USDC plus a Base Sepolia ETH faucet for gas.

## Deploy

**Box office** → Render (blueprint in `box-office/render.yaml`), or any Node ≥ 22 host. Set `PAY_TO`, `TICKET_SECRET`, `TREASURY_PRIVATE_KEY`, and optionally `ANTHROPIC_API_KEY` (enables the in-page agent for visitors without a WebMCP browser *and* the click-to-ask docent) and `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` / `PAY_TO_MAINNET` (enables real USDC on Base).

**Gallery** → build with the box office URL baked in, then publish the one file anywhere:

```bash
cd gallery && VITE_BOX_OFFICE_URL=https://your-box-office.onrender.com npm run build
# dist/index.html is the whole museum
```

Published on Stacktree with `csp_strict=false` (the page talks to the box office and a Base RPC). Stacktree serves Chrome's WebMCP origin-trial token on `*.stacktr.ee`, so the tools work in Chrome stable there without a flag.

## Two rails, one box office

Every paid route advertises two x402 `accepts` options:

| rail | who uses it | facilitator | pays to |
|---|---|---|---|
| Base Sepolia · test USDC (`eip155:84532`) | the visitor wallet generated in the page — judges need nothing | `https://x402.org/facilitator` (public) | the drip treasury, so test revenue refills the faucet |
| Base · real USDC (`eip155:8453`) | any x402 agent with a real wallet (Coinbase payments MCP, agentcash, `@x402/fetch` in a script) | Coinbase CDP (`CDP_API_KEY_ID` / `CDP_API_KEY_SECRET`) — the same setup [Stacktree](https://stacktr.ee) uses for its own paid endpoints | Stacktree's payee wallet |

The mainnet rail switches on when the CDP keys are set (`X402_MAINNET=off` disables it; a failed credential probe at startup degrades to testnet-only rather than breaking ticket routes). An agent that never touches the page can `GET /tickets/van-gogh`, pay the 402 for real, and receive the same signed ticket a visitor's agent gets through WebMCP — first real one: [`0xfa53dc8d…907f`](https://basescan.org/tx/0xfa53dc8d5ac793b6e6157b5e350be4a3ab2412c927869f6a046a7157ce3a907f), 0.02 USDC on Base, paid by an agentcash wallet from a terminal. The box office also publishes an x402 discovery feed at `/.well-known/x402`.

## The x402 flow, by hand

`gallery/src/wallet.ts` does the 402 dance explicitly rather than through `wrapFetchWithPayment`, so the page can show the visitor a quote, apply their policy and record a receipt:

1. `fetch` → `402` with `PAYMENT-REQUIRED` (base64 JSON: `accepts[]` of scheme/network/asset/amount/payTo)
2. pick the `exact` / `eip155:84532` option → quote → policy (`autoApproveUpTo`, or `askEveryTime`) → confirm sheet if needed
3. `x402Client.createPaymentPayload` signs an EIP-3009 `transferWithAuthorization` with the in-page key (gasless; the facilitator submits it)
4. retry with `PAYMENT-SIGNATURE` → the box office verifies and settles via `https://x402.org/facilitator` → `200` + `PAYMENT-RESPONSE` (tx hash)
5. the box office reads the payer from the signature header and issues an HMAC-signed ticket bound to that wallet

## Collection

Twenty-four public-domain works from the Art Institute of Chicago, The Met, The Cleveland Museum of Art, the Rijksmuseum and the J. Paul Getty Museum, each with its museum's credit line and a link to the source record. Rooms: Impressionist Wing (Monet), Van Gogh Room, Print Room (Hokusai, Hiroshige), Dutch Cabinet (Vermeer and Delft).

**Everything hangs to scale.** Each work carries its real dimensions from its museum's own record, and one pixels-per-centimetre factor governs the whole building — so the Great Wave hangs at 25.4 × 37.6 cm, about the size of an open laptop, and Monet's *Wheatstacks* looms over it at more than a metre across. The wall spaces the works by their own width, which is why a room of prints shows six at once and a room of canvases shows two. The size reaches the agent too: `look_around` and `list_artworks` report it, so a docent agent can tell you the thing in front of you is smaller than the poster you know it from.

## Built on

- [agentk](https://github.com/stevysmith/agentk) — one tool catalog → ⌘K palette for humans + WebMCP registration for agents (0.5.0 adds `annotations`, `title` and `isError`; 0.5.1 also defers WebMCP surface changes while a call is in flight, which Chrome <153 needs; vendored in `gallery/vendor/` until the npm release)
- [x402](https://github.com/coinbase/x402) v2 — `@x402/hono`, `@x402/fetch`, `@x402/evm`
- [viem](https://viem.sh), [Hono](https://hono.dev), [Vite](https://vite.dev)

# Devpost submission — Gallery 402

> Working draft of the text description. Fill in the URLs before submitting.

**Live URL:** https://stacktr.ee/p/86HeLDvH8p01xLpff43ybV/ · **Video:** _TBD (YouTube, < 3 min)_ · **Repo:** https://github.com/stevysmith/gallery-402

## Why this use case fits WebMCP

Museums are visual: the whole point is to stand in front of the picture. Paying for admission is not. Today a paywall interrupts the thing you came for — a form, a card, a redirect, a login. Gallery 402 puts the human and the agent on the same page, literally: the visitor looks at Monet while an agent in their browser handles the box office through the page's own WebMCP tools. The agent doesn't scrape the page or drive the cursor; it calls `gallery_buy_ticket` and the page pays over HTTP 402 with a wallet the visitor controls, inside a spending limit the visitor set.

That is the shape of a lot of the future web — content behind small, per-use prices, paid by agents on behalf of people — and WebMCP is the missing piece: a typed, page-provided surface so the agent can act *with* the site rather than *on* it.

## How it improves the experience

- **Nothing leaves the room.** No checkout page, no redirect, no popup. The wall changes colour and the painting is there.
- **The human sets policy; the agent operates inside it.** "Auto-approve up to $0.05" or "ask me every time" — set in the wallet panel, honoured by `buy_ticket`, and deliberately *not* exposed as a tool.
- **Every step is legible.** The ledger narrates quote → policy → signature → settlement, and each settled payment prints a ticket stub with its transaction hash.
- **Same tools, two doors.** The identical catalog is the ⌘K palette for humans and the WebMCP registration for agents. A visitor without an agent-capable browser gets the same actions by hand, or via the in-page agent.

## What humans and agents can do together that they couldn't before

A visitor can say "give me a ten-minute tour about light" and watch the agent compose stops, pay two doors inside their limit, glide them in and spotlight the details — or "buy me a day pass and show me the Great Wave" and watch it happen on the page they are already looking at — the agent discovers the wings and prices, negotiates an HTTP 402, signs a gasless USDC authorization, receives a ticket bound to the visitor's wallet, walks into the room and stops at the right print — while the visitor keeps the only control that matters: how much the agent may spend without asking. Before WebMCP, an agent could only do this by screen-driving a checkout, with no way for the page to express prices, policy or confirmation as first-class actions.

## Implementation

- **WebMCP:** eleven tools registered with `document.modelContext.registerTool` (falling back to `navigator.modelContext`) via agentk's `useWebMCPRegistration` — prefixed `gallery_`, with `readOnlyHint` annotations on the five read-only tools, `title`s, `AbortSignal`-based unregistration, and `isError` on failures so an agent can tell a rejected payment from a receipt. Tool errors are written as next-step instructions ("No ticket for the Van Gogh Room ($0.02). Call buy_ticket…").
- **Three ways in, none of them a dead end:** the museum's own curated tours are one click from the lobby (no agent needed); the ⌘K palette runs the same tools with a multi-step in-page agent; and a WebMCP agent drives the whole thing. New visitors are staked a few cents of test USDC on arrival, and `start_tour` buys the cheapest combination of doors — singles or a day pass — so the money decision is made well rather than blindly.
- **You keep something:** `save_tour` publishes the tour — its works, the docent's notes, and the settlement receipts for what admission cost — as a standalone page on Stacktree that outlives the session.
- **The docent layer:** the agent plans a guided tour into a shared itinerary the visitor edits (reorder, drop), pays for exactly the doors the route needs (a day pass when cheaper), glides the visitor along a wall, spotlights details with its own notes as wall text, and hangs works side by side. The visitor clicks a spot on a painting and the agent reads it (`visitorPointing`) — collaboration in both directions on one canvas. Because WebMCP can't push to the agent, the page also keeps a docent of its own: a click sends the real painting and the click position to a vision model, and the answer comes back as a spotlight and wall text (`ask_docent` exposes the same to agents).
- **The tool surface, shown to the human, priced:** a panel lists what the agent can do right now and animates capabilities in and out as the page changes, with live prices on the tools that spend money (`start_tour` quotes the exact doors the current itinerary needs). A WebMCP page shouldn't only be *usable* by an agent — it should show the human what the agent can do, what it just did, and what it costs. The compatibility suite asserts the panel matches the registered surface exactly, so it can never overstate what an agent may do.
- **A live tool surface:** the registered set follows page state — no `walk` in the lobby, `buy_ticket` only for wings you don't hold (gone once you have a day pass), `enter_wing` only for wings you can enter — re-registered on change so the browser's `toolchange` fires. Reading the tool list tells an agent where the visitor is.
- **Verified against Chrome's real implementation:** the tour flow was driven through Chrome 151's `document.modelContext.executeTool` — which surfaced that pre-153 Chrome aborts an in-flight call when its tool is unregistered. agentk 0.5.1 now defers surface changes until calls return; the eval harness flags any regression.
- **It works in ChatGPT, end to end, through the tools.** Asked *"Get me into the Van Gogh room"* in ChatGPT desktop's Work mode, ChatGPT discovered the site tools, told the visitor the ticket costs $0.02 and that their wallet was empty, asked permission to fund and pay, and on approval called `fund_wallet`, `buy_ticket` and `enter_wing` over `document.modelContext` — the museum's ledger shows the full x402 round trip (quote → policy → EIP-3009 signature → settlement → ticket) driven by the agent, not by clicking. Three gates a judge must pass first — Work mode, a Sol/Terra model, and a per-site browser permission prompt that isn't in the docs — are written up in `CHATGPT-TESTING.md`.
- **Tested inside ChatGPT's in-app browser, not just Chrome.** We drove ChatGPT desktop over CDP and confirmed the museum registers and runs there — including the dynamic surface (12 tools → 16 after loading a tour). Doing it surfaced two host differences the docs don't spell out: ChatGPT exposes **only** `document.modelContext` (no `navigator.modelContext`, which many WebMCP tutorials still use — those pages register nothing there), and its `executeTool` enforces the spec's object argument where Chrome also accepts a JSON string. agentk 0.6.2 handles both; the method is written up in `CHATGPT-TESTING.md`.
- **Compatibility, verified not assumed:** `npm run compat` asserts the page matches ChatGPT's documented site-tools subset (registration on `document.modelContext`, top-level page, no iframes, no declarative forms) and Chrome's published budgets for tool names, descriptions and output, across multiple page states. It caught a 4038-character `list_wings` response — the first call any agent makes — now split into two tools.
- **Evals:** 26 cases run two ways against the real page through a fake `document.modelContext`: a scripted replay (tools compose; payments, approvals, `isError` and surface changes hold) and a model-driven run (a real LLM with the live tool list, judged on which tools it chose — one day pass for "see everything cheaply", no purchase for "what does it cost?").
- **Social proof, live:** the box office keeps a settlements ledger; the lobby shows who was admitted where with tx links, and `whos_here` exposes it to agents.
- **Payments:** x402 v2. The box office (Hono + `@x402/hono`) answers `402` with `PAYMENT-REQUIRED`; the page (viem + `@x402/fetch`/`@x402/evm`) quotes, applies policy, signs EIP-3009 `transferWithAuthorization`, retries with `PAYMENT-SIGNATURE`; the public facilitator verifies and settles USDC on Base Sepolia; the box office reads the payer from the signature and issues an HMAC-signed ticket; artwork is served only to ticket holders.
- **Two payment rails:** each ticket route accepts test USDC on Base Sepolia (the in-page visitor wallet, so judges need nothing) *and* real USDC on Base mainnet through the Coinbase CDP facilitator — the production x402 setup Stacktree already runs. An agent with a real wallet never has to touch the page: it can pay the 402 directly and get the same signed ticket. Proof: an agentcash wallet bought a Van Gogh Room ticket for real — [`0xfa53dc8d…907f`](https://basescan.org/tx/0xfa53dc8d5ac793b6e6157b5e350be4a3ab2412c927869f6a046a7157ce3a907f) on Base, 0.02 USDC from `0xf2de…68bc` to the payee, block 50583731 — and the ticket it received admitted it to the room.
- **Wallet:** a self-custodied key generated in the page and kept in `localStorage`, so it works in ChatGPT's in-app browser with no extension. A testnet faucet tool lets judges try a real settlement in seconds.
- **Hosting:** the museum is one self-contained HTML file published on Stacktree (which serves Chrome's WebMCP origin-trial token); the box office runs on Render.
- **agentk (pre-existing, extended during the challenge):** 0.5.0 adds WebMCP `annotations`, `title` and `isError` to `useWebMCPRegistration`, with tests. All museum code is new for the challenge.

## Prior work vs. new work

- **New (Aug 28 → Sep 3):** everything in this repository — gallery, box office, collection, wallet/x402 flow, tools, design.
- **Pre-existing:** [agentk](https://github.com/stevysmith/agentk) (command palette + WebMCP registration hook, first published July 2026) and [Stacktree](https://stacktr.ee) (static hosting). Changes to agentk made during the challenge are the two commits on the [`webmcp-0.6.2`](https://github.com/stevysmith/agentk/commits/webmcp-0.6.2) branch, dated Aug 30 (WebMCP annotations/title/isError, in-flight surface deferral, multi-step agent runs, and their tests).

## Testing notes for judges

- **ChatGPT desktop:** open the live URL in the in-app browser; the "WebMCP · 10 tools" pill turns green. Ask: "Get me into the Van Gogh room."
- **Chrome:** enable `chrome://flags/#enable-webmcp-testing` (or use the Stacktree URL, which carries the origin trial), then use the Model Context Tool Inspector or Gemini.
- **No agent:** press ⌘K — same tools.
- The wallet starts empty on purpose; "Top up" (or the `fund_wallet` tool) drips 0.05 test USDC. Tickets are $0.01–$0.02; the day pass is $0.04.

## Collection

24 public-domain works (Art Institute of Chicago, The Met, Cleveland Museum of Art, Rijksmuseum, J. Paul Getty Museum), each credited and linked to its source record.

Every work hangs at its true size. Each carries the real dimensions from its museum's own record, and a single pixels-per-centimetre factor governs the whole building — so Hokusai's Great Wave hangs at 25.4 × 37.6 cm, about the size of an open laptop, while Monet's *Wheatstacks* is more than a metre across. The wall spaces works by their own width, so a room of prints shows six at once and a room of canvases shows two. The agent gets the same fact the human reads on the label: `look_around` and `list_artworks` report the dimensions, and so does the free `/wings` manifest — so an agent can tell you a room is six small prints before you pay to walk into it.

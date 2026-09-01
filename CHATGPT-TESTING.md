# Testing in ChatGPT's in-app browser

The judges' primary environment — and as of **Aug 31**, not the only ChatGPT
one: OpenAI's browser lead announced WebMCP support in **ChatGPT Work's cloud
browser**, with a Chrome extension "next". The cloud browser runs remotely, so
`localhost` does not exist there — only a publicly deployed URL can be tested.

**Verified in the cloud browser the day it was announced.** chatgpt.com in Work
mode (5.6 Sol), asked for a boats-and-water tour of the live Stacktree URL: the
cloud browser opened the museum, read the tools, composed a six-stop tour
across three wings, priced the day pass as the cheapest set of doors ($0.04),
asked before spending, then bought it over live testnet rails — faucet drip,
settlement, "$0.01 remains" — and started the tour at Water Lilies. Two notes:
the per-site gate exists here too, worded *"Allow ChatGPT to access stacktr.ee
with the cloud browser?"* (Allow all relevant sites / Allow for this chat /
Deny); and it excluded the Great Wave as too fierce for a child — agent
judgment, not a tool limitation.

(Everything below documents the desktop app's local in-app browser.) ChatGPT desktop is Electron on Chromium, so it
can be driven over the Chrome DevTools Protocol.

## Setup (macOS)

```bash
osascript -e 'tell application "ChatGPT" to quit'
env -u NODE_OPTIONS "/Applications/ChatGPT.app/Contents/MacOS/ChatGPT" --remote-debugging-port=9333 &
agent-browser connect 9333
```

Two gotchas: the app must be **quit first** (the flag only applies at launch),
and `NODE_OPTIONS` must be cleared — a stray `--openssl-legacy-provider` makes
Electron refuse to start.

Open the side panel in the app (its browser view appears as an `about:blank`
target), then:

```bash
agent-browser tab                       # list targets
agent-browser navigate "http://<your gallery>/"
agent-browser eval "JSON.stringify({ mc: typeof document.modelContext })"
```

## Three gates before an agent will touch the page

1. **Work mode.** In Chat mode ChatGPT refuses outright — *"I can't control the open browser from this chat without switching to Work mode."* The docs agree: "In the built-in browser in the ChatGPT desktop app, ChatGPT **Work** and Codex can discover and use these tools."
2. **A model that supports it.** "Use GPT-5.6 Sol or GPT-5.6 Terra for site tools. GPT-5.6 Luna currently has WebMCP disabled." Note the composer's *Instant / Light / Thinking* control is **effort**, not the model — check the model line says Sol or Terra.
3. **Per-site browser permission.** The first time, ChatGPT asks *"Allow ChatGPT to access http://localhost:5173?"* with Allow once / Allow for all sites / Deny. This prompt is **not in the docs** — expect it and click through.

Then, per the docs, "each tool invocation receives a safety review before it runs" — in our run ChatGPT paused and asked the human to confirm funding the wallet and paying, on top of the museum's own spending policy. A visitor can see what a site offers via **Site tools** in the browser's address bar.

## A fifth client: agent-browser's native WebMCP bridge

agent-browser ≥0.36 (`npm i -g agent-browser`) exposes any page's WebMCP surface
from the terminal — `webmcp list`, `webmcp invoke <tool> --params <json>`. The
museum worked through it first try, including a live settlement, with no
museum-specific code on either side. Two protocol notes: it launches its own
Chromium with the WebMCP flag enabled (no origin trial needed), and long-running
tools (a payment awaiting settlement) want `--timeout` raised or `--detach` +
`webmcp result <id>`.

## What we verified there

| | ChatGPT in-app browser | Chrome 151 |
|---|---|---|
| `document.modelContext` | ✅ | ✅ |
| `navigator.modelContext` | ❌ **absent** | ✅ |
| `executeTool(tool, input)` | **object only** — a JSON string throws | object *or* JSON string |
| return value | JSON string of the result envelope | same |
| our tools registered | 12 in the lobby, by name | same |
| dynamic surface | ✅ 12 → 16 after `take_tour`, `start_tour` in / `take_tour` out | same |

**The `executeTool` signature is still churning across builds.** We have now
seen three conventions in the wild: ChatGPT requires `(name, object)`; Chrome
151 takes `(name, jsonString)`; a newer origin-trial Chromium (Playwright's
bundled build) requires `(RegisteredTool descriptor, jsonString)` — the
descriptor from `getTools()`, which itself returns a Promise there. Pages are
unaffected (registration is stable); anything *driving* tools should probe.

Both differences are handled in agentk 0.6.2: it registers on whichever object
exists (preferring `document`), and `executeTool` sends an object, falling back
to a JSON string only if the host complains. A page written against
`navigator.modelContext` — as several WebMCP tutorials still show — registers
nothing at all in ChatGPT.

`http://localhost` is a secure context, so WebMCP works without HTTPS while
developing.

## The end-to-end run, in ChatGPT

Prompt: **"Get me into the Van Gogh room."** ChatGPT read the museum, then asked:

> "The Van Gogh Room ticket costs $0.02 in test USDC on Base Sepolia. Your gallery wallet is currently empty, so I'll need to fund it from the museum's test faucet and then make that payment. Do you confirm both actions?"

On approval, the museum's own ledger recorded — `agent` rows are calls that came through
`document.modelContext`, not DOM clicks:

```
agent  Agent asked the box office for a ticket: Van Gogh Room
x402   Box office quotes $0.02 — ticket to the Van Gogh Room
ok     Within your policy (≤ $0.05) — paying without asking
x402   Signed a USDC transfer authorization (EIP-3009). No gas, no popup.
ok     Settled on-chain · 0xmocke809…
ok     Ticket issued: Van Gogh Room · admit one
agent  Agent entered the Van Gogh Room.
```

(The box office was in `X402_MODE=mock` for this run, so no real settlement.)

## Full journey, also in ChatGPT

Follow-up prompt: **"Now take the museum's own tour about light, start it, walk me to
the second stop, and then save the tour as a page and give me the link."**

ChatGPT composed its own four-stop *Light* tour spanning four rooms, read back the
museum's own pricing logic — *"Starting it will buy a $0.04 test-USDC day pass"* —
asked for confirmation of the payment **and** the publish, then ran it. Final state,
read from the page:

```
tour   { theme: "Light", status: "active", cursor: 1, stops: 4 }
tickets ["van-gogh", "*"]           ← day pass bought, as it said it would
artwork "the-bedroom"                ← second stop, as asked
saved  https://stacktr.ee/p/…/       ← keepsake page published for real
```

The published page: HTTP 200, 235 KB, four stops, four images inlined as data URIs,
footer reading *"4 stops · admission $0.12, paid over HTTP 402"*.

**Debugging tip:** the ledger collapses itself inside a room, and `.act` rows only
exist while it is open — expand it before scraping, or you will conclude nothing
happened.

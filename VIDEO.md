# Gallery 402 — submission video (target 2:45, hard cap 3:00)

Deliverable: one YouTube upload. Screen recordings are yours; every card, diagram
and caption is rendered by `video/` (see bottom). Record at 1920×1080, trackpad
cursor visible, sound off. QuickTime screen recording is fine.

## Script

Times are targets; trim recordings to fit, never the other way.

---

**0:00 – 0:10 · COLD OPEN — recording R1**
Screen: ChatGPT desktop (Work mode), museum already open in the in-app browser.
Type: **"We've got ten minutes and my daughter loves boats and water — build us a tour, skip anything gloomy. You can spend up to 5 cents."** Send.
Cut before the reply finishes streaming.

> VO: "This museum charges admission at every door. My agent is about to pay it —
> and the page is going to tell it how."

**0:10 – 0:18 · TITLE — asset `Title.mp4`**

> VO: "Gallery 402. A virtual museum with real paywalls: four rooms,
> twenty-four masterworks, every ticket a cent or two over HTTP 402."

**0:18 – 0:22 · CARD — asset `Card-human.mp4`** ("THE HUMAN PATH / You look at the paintings.")

**0:22 – 0:55 · THE HUMAN PATH — recording R2**
Screen: fresh visit in Chrome (clear localStorage first, so the drip shows).
Beats to capture: wallet fills to $0.05 on arrival → click **Buy** on the Print
Room → the ledger narrates quote → policy → signature → **Settled on-chain** →
balance drops to $0.04 → click **Enter** → the wall glides, the Great Wave hangs
tiny at true size → click its label's Basescan link, show the transaction, back.

> VO: "A visitor arrives with nothing. The museum stakes them five cents of test
> USDC, on chain. One click buys a door — watch the ledger: the box office quotes,
> the wallet checks the visitor's spending limit, signs a gasless USDC
> authorization, and the payment settles on Base. That hash is a real
> transaction. The full-resolution Hokusai is only served because we now hold a
> signed ticket — and it hangs at its true size: thirty-seven centimetres,
> about the size of an open laptop."

**0:55 – 1:15 · THE MECHANISM — asset `X402Flow.mp4`**

> VO: "Under every door, the same handshake. The page asks for the room; the box
> office answers 402, Payment Required, with a price. The wallet checks policy,
> signs an EIP-3009 transfer — no gas, no popup — and a facilitator settles USDC
> on Base. The box office reads the payer from the signature and issues a ticket
> bound to that wallet. No account. No card form. No redirect."

**1:15 – 1:19 · CARD — asset `Card-agent.mp4`** ("THE AGENT PATH / Your agent buys the tickets.")

**1:19 – 2:05 · THE AGENT PATH — recording R1 continued (the centerpiece)**
Screen: back to ChatGPT. Let the reply play: it discovers the tools, quotes the
day-pass price, **asks permission to spend**, then calls fund_wallet /
buy_ticket / enter_wing / tour_step — the museum moving by itself, ledger rows
marked `agent`. End on save_tour publishing the keepsake page; open the link.

> VO: "Now the same museum, driven through its tools. Notice this tour is not one
> the museum wrote — no curator planned boats, for a ten-year-old, in ten
> minutes. ChatGPT composed it: the agent knows the visitor, the page knows the
> collection, and plan_tour is where they meet. It reads the page's
> WebMCP surface — not the pixels — sees what each door costs, and asks before it
> spends: the human sets the allowance, the agent operates inside it. Then it
> pays, walks the rooms, and saves the visit as a page we keep. Every row in that
> ledger marked 'agent' is a tool call; every dollar sign in it settled on chain."

**2:05 – 2:09 · CARD — asset `Card-surface.mp4`** ("THE SURFACE / Tools follow the room.")

**2:09 – 2:30 · THE LIVING SURFACE — recording R3**
Screen: the tool-surface panel open (click the WebMCP pill). Buy a ticket —
watch `buy_ticket` for that wing vanish and `enter_wing` appear, rows animating.
If comfortable, show Chrome DevTools' WebMCP panel listing the same tools.

> VO: "The tool list is alive. Eleven tools in the lobby; seventeen once you
> hold a ticket. Buy a door and buy_ticket disappears for it, enter_wing
> appears — reading the surface tells an agent where the visitor is standing.
> None of the current showcase apps change their surface at all."

**2:30 – 2:45 · CLOSE — asset `EndCard.mp4`**

> VO: "A museum makes the paywall visible — but swap the collection for a news
> archive, a research corpus, or a metered API, and nothing about the mechanism
> changes. This is the web selling to agents without making them pretend to be
> human. Gallery 402 — payment required, and that's the point."

---

## Recording checklist

- **R1** (ChatGPT): Work mode, Sol/Terra model, museum tab open, site permission
  pre-granted (do a throwaway run first so the prompt doesn't interrupt the take).
- **R2** (Chrome): clear localStorage; box office pre-warmed (hit /health once
  ~1 min before recording so the free tier is awake).
- **R3**: the surface panel open before you start; slow deliberate clicks.
- Record everything at 1920×1080; don't resize the window mid-take.

## Assets — `video/`

```bash
cd video && npm install && npm run render     # renders all five to video/out/
```

`Title.mp4` (8s) · `X402Flow.mp4` (20s) · `Card-human.mp4` / `Card-agent.mp4` /
`Card-surface.mp4` (4s each) · `EndCard.mp4` (12s). 1920×1080/30fps, museum
palette (green wall, paper, brass), Instrument Serif + IBM Plex — they cut
against the recordings without a seam.

Assemble in any editor; the VO reads at ~140 wpm. Total: ~2:45.

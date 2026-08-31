# Gallery 402 — submission video (target 2:45, hard cap 3:00)

Deliverable: one YouTube upload. Screen recordings are yours; every card, diagram
and caption is rendered by `video/` (see bottom). Record at 1920×1080, trackpad
cursor visible, sound off. QuickTime screen recording is fine.

## Script

Times are targets; trim recordings to fit, never the other way. The order is
payoff-first: a judge who stops at thirty seconds has already seen an agent pay.

---

**0:00 – 0:28 · COLD OPEN — THE PAYOFF, COMPRESSED — recording R1**
No logo. Screen: ChatGPT (Work mode), museum open. Show the prompt being typed
(2s): **"We've got ten minutes and my daughter loves boats and water — build us
our own tour, skip anything gloomy. You can spend up to 5 cents."** Hard cut to
ChatGPT's reply: the composed tour, **"$0.04 day pass. Shall I confirm?"** —
type "Yes" — cut to the museum moving by itself: ledger rows landing,
*Settled on-chain*, the wall gliding to stop 1.

> VO: "I asked my agent for a museum tour no curator ever wrote. It read the
> page's own tools — not the pixels — composed six stops for a ten-year-old who
> loves boats, priced the cheapest set of doors, and asked me before spending a
> real cent. Then it paid over HTTP 402, on chain, and started walking."

**0:28 – 0:36 · TITLE — asset `Title.mp4`**

> VO: "Gallery 402. A virtual museum where every door costs a cent or two —
> and the box office is a tool surface."

**0:36 – 0:52 · THE MECHANISM — asset `X402Flow.mp4` (trim to ~16s)**

> VO: "Under every door, the same handshake: the box office answers 402 with a
> price; the wallet checks the visitor's limit and signs a gasless USDC
> authorization; a facilitator settles on Base; the ticket is bound to the
> payer. No account, no card form, no redirect."

**0:52 – 1:22 · PROOF IT'S REAL — recording R2 (the human path, tightened)**
Fresh visit in Chrome: wallet fills to $0.05 on arrival → buy the Print Room →
ledger: quote → policy → signature → **Settled on-chain** → balance drops →
Enter → the Great Wave hangs tiny at true size → click through to Basescan,
show the transaction, back.

> VO: "The paywall is real. A visitor arrives with nothing; the museum stakes
> them five cents of test USDC on chain. One click buys a door — that hash is a
> real transaction — and the full-resolution Hokusai is served only because we
> hold a signed ticket. It hangs at its true size: thirty-seven centimetres,
> about the size of an open laptop."

**1:22 – 2:02 · BACK TO THE AGENT — recording R1 continued**
The tour running: walk two stops, the docent note appearing as wall text; if
the take includes it, ChatGPT's question for the daughter — *"Which boat would
you choose?"* — deserves 3 full seconds of silence. End on save_tour publishing
the keepsake; open the link.

> VO: "Back on the tour, the human sets exactly one thing: how much the agent
> may spend without asking. Buying is a distinct, annotated action — that's why
> an agent can be trusted near it at all, and why it paused to ask. It walks us
> room to room… and at one stop, unprompted, it asks my daughter which boat
> she'd choose. Then it saves the visit as a page we keep — receipts included."

**2:02 – 2:22 · THE SURFACE IS ALIVE — recording R3**
The tool-surface panel open. Buy a ticket — watch buy_ticket vanish and
enter_wing appear, rows animating. DevTools' WebMCP panel if comfortable.

> VO: "And the tool list itself is alive: twelve tools in the lobby, eighteen
> once you hold a ticket. Reading the surface tells an agent where you're
> standing. None of the current showcase apps change their surface at all."

**2:22 – 2:42 · CLOSE — asset `EndCard.mp4`**

> VO: "A museum makes the paywall visible — but swap the collection for a news
> archive, a research corpus, or a metered API, and nothing about the mechanism
> changes. This is the web selling to agents without making them pretend to be
> human. Gallery 402 — payment required. And that's the point."

---

Cut for time, kept as spares: the three section cards (`Card-*.mp4`) — use one
if a transition feels abrupt, but the recordings should butt-cut fine.

## Recording checklist

- **R1** (ChatGPT): Work mode, Sol/Terra model, site permission pre-granted (do a
  throwaway run first so the prompt doesn't interrupt the take). **Open the LIVE
  Stacktree URL in the in-app browser BEFORE starting a new Work chat** — the
  thread binds to whichever tab it starts with and ignores later navigation; a
  stale binding will silently drive the wrong page.
  Alternative worth considering: record R1 on chatgpt.com's **cloud browser**
  instead (announced Aug 31, verified working) — same prompt, and the "Cloud
  browser" side panel showing the museum makes the remote-agent story visible.
  Spare artifact either way: the cloud run already published a keepsake at
  https://stacktr.ee/p/kn4w4M1hPFKLkjaddpFwnq/ — usable as a cutaway.
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

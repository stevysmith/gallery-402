# Gallery 402 — submission video (picture-locked at 2:48, hard cap 3:00)

Deliverable: one YouTube upload. Screen recordings are yours; every card, diagram
and caption is rendered by `video/` (see bottom). Record at 1920×1080, trackpad
cursor visible, sound off. QuickTime screen recording is fine.

## Script — the voice is ElevenLabs (George), one clip per beat

Times below are the picture-lock, to the second. The VO is not one take: it is
thirteen cues in `video/vo/script.mjs`, each pinned to the second its picture
beat starts (~375 words ≈ 2:15 of speech over 2:48 of picture). Beat notes in
*italics* say where a phrase lands. The order is payoff-first: a judge who
stops at thirty seconds has already seen an agent pay.

---

**0:00 – 0:36 · COLD OPEN — THE PAYOFF, COMPRESSED**
*Picture: the ask typed 0:00–0:10 · the agent working, 28× 0:10–0:13 · the
six-stop reply, "$0.04 day pass… Shall I make that payment?", "Yes", the
purchase, Water Lilies hung at stop 1 of 6 — 0:13–0:36.*

> VO (start ~0:02, unhurried): "I asked my agent for a museum tour no curator
> ever wrote. It read the page's own tools — not the pixels — *(over the 28×)*
> composed six stops for a daughter who loves boats, priced the cheapest set
> of doors, and asked me before spending a real cent. *(let "Shall I make that
> payment?" sit on screen)* *(0:26, on the x402 ledger rows)* Then it paid
> over HTTP 402, on chain, and started walking." *(the Lilies hang at ~0:31;
> the picture holds in silence to the title)*

**0:36 – 0:44 · TITLE**

> VO: "Gallery 402. A virtual museum where every door costs a cent or two —
> and the box office is a tool surface." *(7.8s of words for 8s of card)*

**0:44 – 1:03 · THE MECHANISM — the handshake diagram, 19s**
*Wires fire at: GET 0:45 · 402 0:48 · signature 0:52 · settled 0:55 · ticket
0:58 · "No account. No card form. No redirect." appears 1:00.*

> VO: "Under every door, the same handshake: the box office answers 402 with a
> price; the wallet checks the visitor's limit and signs a gasless USDC
> authorization; a facilitator settles on Base; the ticket is bound to the
> payer. No account, no card form, no redirect." *(45 words, 18.1s — lands exactly)*

**1:03 – 1:26 · PROOF IT'S REAL — the human path in Chrome**
*Picture: drip → buy the Print Room → ledger settles 1:03–1:12 · the Basescan
transaction 1:12–1:17 · Enter → the Great Wave at true size 1:17–1:26.*

> VO: "The paywall is real. A visitor arrives with nothing; the museum stakes
> them five cents of test USDC. One click buys a door — *(on the Basescan
> still)* that hash is a real transaction on Base — and the full-resolution
> Hokusai is served only because we hold a signed ticket, hung at its true
> size: thirty-seven centimetres — about an open laptop."

**1:26 – 2:15 · BACK TO THE AGENT**
*Picture: the docent note at Water Lilies 1:26–1:34 · fast-forward · the walk:
Cliff Walk 1:35–1:47, Sunrise (Marine) with "Boat stop! … pick the one you
would captain" 1:47–1:53 · fast-forward · "Published:" link 1:55–2:03 · the
keepsake page scrolling 2:03–2:15, ending on the receipt.*

> VO: "Back on the tour, the human set exactly one thing: how much the agent
> may spend without asking. Buying is a distinct, annotated action — that's
> why an agent can be trusted near it, and why it paused to ask."
>
> *(1:42)* "It walks us room to room, writing a wall note for her at every
> stop… and at the sunrise, unprompted, it asks her which boat she'd captain."
> *("captain" lands on the Sunrise, ~1:51)*
>
> *(on "Published:", 1:55)* "Then it publishes the visit as a page we keep —
> every stop, every note, every receipt, on one link."
>
> *(over the scroll, 2:06)* "Every note it wrote for her is on there, and the
> receipt at the bottom. That's the visit — not a screenshot of it."

**2:15 – 2:29 · THE SURFACE IS ALIVE**
*Picture: the tool panel open at 12 tools → buy the Dutch Cabinet → the count
ticks to 14 and `enter_wing` appears in the list.*

> VO: "And the tool list is alive: twelve tools in the lobby — buy a door and
> enter_wing appears; step inside and there are eighteen. Reading the surface
> tells an agent where you're standing." *(12.1s over a 14s clip)*

**2:29 – 2:48 · CLOSE — end card**

> VO *(starts on the last frames of the panel, 2:28)*: "A museum just makes
> the paywall visible. Swap the collection for a news archive, a research
> corpus, a metered API — nothing about the mechanism changes. This is the web
> selling to agents without making them pretend to be human. Gallery 402.
> Payment required — and that's the point." *(then silence on the URLs)*

---

Changed from the earlier draft, on checking the takes: the prompt says "my
daughter", never her age (was "ten-year-old"); the docent's question is which
boat she'd *captain*; the panel on screen goes 12 → 14 on purchase and 18 only
once you're in a room; the keepsake scroll got its own line; the "none of the
showcase apps…" claim was cut — no time for it, and it's the one sentence a
judge who built one could take personally.

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

`Title.mp4` (8s) · `X402Flow.mp4` (20s, 19s used) · `Card-human.mp4` / `Card-agent.mp4` /
`Card-surface.mp4` (4s each) · `EndCard.mp4` (12s). 1920×1080/30fps, museum
palette (green wall, paper, brass), Instrument Serif + IBM Plex — they cut
against the recordings without a seam.

## Putting it together — Remotion packages the whole film

The recordings are done and the picture is locked; the `Final` composition
cuts the whole film from an edit table (`video/src/edits.ts`) and lays the
voice over it — no editing app needed.

1. **Voice**: `cd video && ELEVENLABS_API_KEY=… node vo/generate.mjs --voice George`
   generates one mp3 per cue in `video/vo/script.mjs` into `assets/vo/`
   (gitignored) and prints a fit table — each cue's length against the picture
   it has before the next cue. `--only <id>` regenerates a single cue after a
   text change; `--voice Daniel` is the other British option.
2. **Conform**: with `VO = 'cues'` in `edits.ts`, every cue plays at its `at`.
   If the table says a cue overruns, nudge a `duration` in the EDL and the
   `at`/`slot` of the cues after it (they are absolute seconds, so a change
   moves everything downstream) — or re-run that cue with `--speed 1.05`.
3. **Render**: `npm run render:final` → `out/gallery-402-submission.mp4`,
   1080p/30 with dip-to-wall transitions. Upload to YouTube (public);
   thumbnail is `out/thumbnail.png`.

A human read is still possible: record to `out/gallery-402-silent.mp4`, save
as `assets/vo.m4a`, set `VO = 'vo.m4a'`.

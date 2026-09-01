/**
 * The voice-over, one cue per picture beat. `at` is the second in the
 * picture-lock (out/gallery-402-silent.mp4) where the cue starts; `slot` is
 * how many seconds of picture it has before the next cue must begin.
 * Text is written for the ear: numerals spelt as they should be said.
 */
export const CUES = [
  // 0:00 – 0:36 cold open
  { id: '01-cold-open-a', at: 2, slot: 8,
    text: 'I asked my agent for a museum tour no curator ever wrote.' },
  { id: '02-cold-open-b', at: 10, slot: 16.5,
    text: 'It read the page\'s own tools — not the pixels — composed six stops for a daughter who loves boats, priced the cheapest set of doors, and asked me before spending a real cent.' },
  { id: '03-cold-open-c', at: 26.5, slot: 9.8,
    text: 'Then it paid over HTTP four-oh-two, on chain, and started walking.' },
  // 0:36 – 0:44 title
  { id: '04-title', at: 36.3, slot: 8.3,
    text: 'Gallery four-oh-two. A virtual museum where every door costs a cent or two — and the box office is a tool surface.' },
  // 0:44 – 1:03 mechanism (wires: GET 0:45 · 402 0:48 · sign 0:52 · settled 0:55 · ticket 0:58 · closing line 1:00)
  { id: '05-mechanism', at: 44.6, slot: 18.9,
    text: 'Under every door, the same handshake: the box office answers four-oh-two with a price; the wallet checks the visitor\'s limit and signs a gasless USDC authorization; a facilitator settles on Base; the ticket is bound to the payer. No account, no card form, no redirect.' },
  // 1:03 – 1:26 proof (pay 1:03 · basescan still 1:12 · enter → Great Wave 1:17)
  { id: '06-proof-a', at: 63.5, slot: 8,
    text: 'The paywall is real. A visitor arrives with nothing; the museum stakes them five cents of test USDC.' },
  { id: '07-proof-b', at: 71.5, slot: 15,
    text: 'One click buys a door — that hash is a real transaction on Base — and the full-resolution Hokusai is served only because we hold a signed ticket, hung at its true size: thirty-seven centimetres — about an open laptop.' },
  // 1:26 – 2:15 agent path (docent hold 1:26 · walk 1:35 · Sunrise 1:47–1:53 · published 1:55 · keepsake 2:03–2:15, receipt from ~2:13)
  { id: '08-agent-a', at: 86.5, slot: 15.5,
    text: 'Back on the tour, the human set exactly one thing: how much the agent may spend without asking. Buying is a distinct, annotated action — that\'s why an agent can be trusted near it, and why it paused to ask.' },
  { id: '09-agent-b', at: 102, slot: 13.5,
    text: 'It walks us room to room, writing a wall note for her at every stop… and at the sunrise, unprompted, it asks her which boat she\'d captain.' },
  { id: '10-agent-c', at: 115.5, slot: 11,
    text: 'Then it publishes the visit as a page we keep — every stop, every note, every receipt, on one link.' },
  { id: '10b-keepsake', at: 126.5, slot: 8.8,
    text: 'Every note it wrote for her is on there, and the receipt at the bottom. That\'s the visit — not a screenshot of it.' },
  // 2:15 – 2:29 surface
  { id: '11-surface', at: 135.3, slot: 13.2,
    text: 'And the tool list is alive: twelve tools in the lobby — buy a door and enter wing appears; step inside and there are eighteen. Reading the surface tells an agent where you\'re standing.' },
  // 2:29 – 2:48 close (end card from 2:29)
  { id: '12-close', at: 148.5, slot: 19.3,
    text: 'A museum just makes the paywall visible. Swap the collection for a news archive, a research corpus, a metered API — nothing about the mechanism changes. This is the web selling to agents without making them pretend to be human. Gallery four-oh-two. Payment required — and that\'s the point.' },
]

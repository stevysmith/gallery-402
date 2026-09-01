/**
 * The edit decision list. One entry per picture segment, in order. Steve drops
 * recordings into video/assets/ and tunes `startFrom`/`duration` here; the
 * Final composition renders the whole film from this table plus vo.mp3.
 *
 * Workflow: record VO first (one take, reading VIDEO.md at ~140wpm), then cut
 * picture to the VO — radio-cut style. `duration` is seconds on screen;
 * `startFrom` is seconds into the source recording to begin at.
 */
export type Segment =
  | { kind: 'card'; comp: 'Title' | 'X402Flow' | 'EndCard'; duration: number }
  | { kind: 'clip'; src: string; startFrom: number; duration: number; label: string; rate?: number; dipIn?: boolean; dipOut?: boolean }
  | { kind: 'still'; src: string; duration: number; label: string }

/** Drop the voice take in video/assets/ then flip this on for the final render. */
export const VO_FILE: string | null = null // 'vo.m4a'

export const EDL: Segment[] = [
  // 0:00 cold open — the clean re-take (take2: sidebar collapsed, fresh chat,
  // museum staged at gallery402.stacktr.ee before rolling)
  { kind: 'clip', src: 'r1-take2.mp4', startFrom: 2, duration: 10, label: 'cold open: the ask typed', dipOut: false },
  // the 84 thinking seconds, fast-forwarded — the skip becomes the agent working
  { kind: 'clip', src: 'r1-take2.mp4', startFrom: 12, duration: 3, rate: 28, label: 'cold open: agent working (28×)', dipIn: false, dipOut: false },
  { kind: 'clip', src: 'r1-take2.mp4', startFrom: 96, duration: 26, label: 'cold open: ask → yes → purchase → Water Lilies', dipIn: false },
  { kind: 'card', comp: 'Title', duration: 8 },
  { kind: 'card', comp: 'X402Flow', duration: 19 }, // through the closing line ('No account. No card form. No redirect.')
  // 0:52 proof it's real — R2: drip, buy, ledger settles…
  { kind: 'clip', src: 'r2-chrome.mp4', startFrom: 5, duration: 9, label: 'human path: pay' },
  // …the transaction itself (basescan refuses headless filming; a still works)
  { kind: 'still', src: 'basescan.jpg', duration: 4, label: 'the settlement' },
  // …then walk in to the Great Wave at true size
  { kind: 'clip', src: 'r2-chrome.mp4', startFrom: 14, duration: 9, label: 'human path: enter' },
  // 1:22 back to the agent — R1 continued: tour runs, docent notes, save_tour
  { kind: 'clip', src: 'r1-take2.mp4', startFrom: 126, duration: 12, label: 'agent path: docent note hold' },
  { kind: 'clip', src: 'r1-take2.mp4', startFrom: 150, duration: 18, label: 'agent path: the walk (Lilies → Cliff Walk → Sunrise)' },
  { kind: 'clip', src: 'r1-take2.mp4', startFrom: 200, duration: 10, label: 'agent path: published' },
  // 2:02 the living surface — R3
  { kind: 'clip', src: 'r3-surface.mp4', startFrom: 4, duration: 12.5, label: 'surface' },
  { kind: 'card', comp: 'EndCard', duration: 12 },
]

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
  | { kind: 'clip'; src: string; startFrom: number; duration: number; label: string }
  | { kind: 'still'; src: string; duration: number; label: string }

/** Drop the voice take in video/assets/ then flip this on for the final render. */
export const VO_FILE: string | null = null // 'vo.m4a'

export const EDL: Segment[] = [
  // 0:00 cold open — r1a has prompt+thinking; r1b has ask → "Yes" → purchase →
  // tour starting (the money frames); r1c has the walk + publish. Trim points
  // below are placeholders until the VO lands — the beats live in these files.
  { kind: 'clip', src: 'r1a-chatgpt.mp4', startFrom: 4, duration: 10, label: 'cold open: the ask typed' },
  { kind: 'clip', src: 'r1b-chatgpt.mp4', startFrom: 6, duration: 24, label: 'cold open: ask → yes → purchase → Water Lilies' },
  { kind: 'card', comp: 'Title', duration: 8 },
  { kind: 'card', comp: 'X402Flow', duration: 16 }, // trims the 20s render on the outro
  // 0:52 proof it's real — R2: drip, buy, ledger settles…
  { kind: 'clip', src: 'r2-chrome.mp4', startFrom: 0, duration: 13.5, label: 'human path: pay' },
  // …the transaction itself (basescan refuses headless filming; a still works)
  { kind: 'still', src: 'basescan.jpg', duration: 4, label: 'the settlement' },
  // …then walk in to the Great Wave at true size
  { kind: 'clip', src: 'r2-chrome.mp4', startFrom: 13.5, duration: 9.5, label: 'human path: enter' },
  // 1:22 back to the agent — R1 continued: tour runs, docent notes, save_tour
  { kind: 'clip', src: 'r1b-chatgpt.mp4', startFrom: 48, duration: 12, label: 'agent path: docent note hold' },
  { kind: 'clip', src: 'r1c-chatgpt.mp4', startFrom: 18, duration: 32, label: 'agent path: the walk' },
  { kind: 'clip', src: 'r1c-chatgpt.mp4', startFrom: 70, duration: 8, label: 'agent path: published' },
  // 2:02 the living surface — R3
  { kind: 'clip', src: 'r3-surface.mp4', startFrom: 0, duration: 16.5, label: 'surface' },
  { kind: 'card', comp: 'EndCard', duration: 12 },
]

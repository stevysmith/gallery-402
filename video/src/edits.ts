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

export const VO_FILE = 'vo.m4a' // drop your voice take in video/assets/

export const EDL: Segment[] = [
  // 0:00 cold open — R1: prompt typed, jump-cut to the ask, "Yes", museum moving
  { kind: 'clip', src: 'r1-chatgpt.mov', startFrom: 0, duration: 28, label: 'cold open' },
  { kind: 'card', comp: 'Title', duration: 8 },
  { kind: 'card', comp: 'X402Flow', duration: 16 }, // trims the 20s render on the outro
  // 0:52 proof it's real — R2: drip, buy, ledger, settle, enter, Basescan
  { kind: 'clip', src: 'r2-chrome.mov', startFrom: 0, duration: 30, label: 'human path' },
  // 1:22 back to the agent — R1 continued: tour runs, docent notes, save_tour
  { kind: 'clip', src: 'r1-chatgpt.mov', startFrom: 28, duration: 40, label: 'agent path' },
  // 2:02 the living surface — R3
  { kind: 'clip', src: 'r3-surface.mov', startFrom: 0, duration: 20, label: 'surface' },
  { kind: 'card', comp: 'EndCard', duration: 12 },
]

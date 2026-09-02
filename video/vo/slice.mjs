/**
 * Cut a human read of the script into the per-cue clips the Final composition
 * plays — so a take recorded freely (pausing wherever the reader pauses, no
 * picture running) still lands on the picture beats, without an editing app.
 *
 *   node vo/slice.mjs assets/v0.m4a [--out vo-steve] [--target -18] [--noise -35] [--gap 0.7]
 *
 * The take is cleaned once — high-pass, gentle compression, loudness-normalised
 * to --target LUFS, true-peak limited — and written to assets/<out>/_take.wav.
 * Then it is cut at its own silences: the runs of speech are grouped into
 * CUES.length consecutive cues, picking the grouping whose spoken seconds per
 * cue best match that cue's word count. One MP3 per cue lands in assets/<out>/;
 * set `VO = 'cues:<out>'` in src/edits.ts to play them at each cue's `at`.
 * Prints the same fit table as generate.mjs — check the boundaries it chose
 * sit on long pauses, then listen to the render.
 */
import { mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { CUES } from './script.mjs'

const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : dflt }
const IN = process.argv[2]
if (!IN || IN.startsWith('--')) { console.error('usage: node vo/slice.mjs <take.m4a> [--out vo-steve] [--target -18] [--noise -35] [--gap 0.7]'); process.exit(1) }
const OUT_NAME = arg('out', 'vo-steve')
const TARGET = Number(arg('target', '-18'))   // LUFS, integrated
const NOISE = Number(arg('noise', '-35'))     // dB on the raw take: quieter than this is a pause
const GAP = Number(arg('gap', '0.7'))         // s: the shortest pause that splits two runs of speech
const PAD_IN = 0.15, PAD_OUT = 0.35           // s of the take kept either side of a cue's speech
const OUT = new URL(`../assets/${OUT_NAME}/`, import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const TAKE = `${OUT}_take.wav`

const ff = (args) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-y', ...args], { encoding: 'utf8', maxBuffer: 64 << 20 })
  if (r.status !== 0) { console.error(r.stderr); process.exit(1) }
  return r.stderr
}
const secs = (f) => Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout.trim())
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`

// 1. clean and level the whole take once, so every cue sits at the same height:
//    high-pass, gentle compression, a static gain to --target, a true-peak
//    limiter for the few transients a compressor's attack lets through
const CHAIN = 'highpass=f=80,acompressor=threshold=-30dB:ratio=3:attack=4:release=120:knee=6'
const meter = (f, chain) => { const r = ff(['-i', f, '-af', `${chain},ebur128=peak=true`, '-f', 'null', '-']); return { i: Number(r.match(/Integrated loudness:\s+I:\s*(-?[\d.]+) LUFS/)[1]), peak: Number(r.match(/True peak:\s+Peak:\s*(-?[\d.]+) dBFS/)[1]) } }
const before = meter(IN, CHAIN).i
const gain = TARGET - before
ff(['-i', IN, '-af', `${CHAIN},volume=${gain.toFixed(2)}dB,alimiter=limit=0.84:attack=5:release=60:level=false`, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', TAKE])
const after = meter(TAKE, 'anull')
console.log(`take: ${IN} · ${secs(IN).toFixed(1)}s · ${before.toFixed(1)} LUFS → +${gain.toFixed(1)} dB → ${after.i.toFixed(1)} LUFS, peak ${after.peak.toFixed(1)} dBTP\n`)

// 2. the runs of speech, from the take's own pauses
const dur = secs(TAKE)
const det = ff(['-i', IN, '-af', `silencedetect=noise=${NOISE}dB:d=${GAP}`, '-f', 'null', '-']) // the raw take: same clock, the level --noise is tuned for
const starts = [...det.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]))
const ends = [...det.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]))
let blocks = []
let cursor = 0
for (let i = 0; i < starts.length; i++) {
  if (starts[i] > cursor) blocks.push({ s: cursor, e: starts[i] })
  cursor = ends[i] ?? dur
}
if (cursor < dur) blocks.push({ s: cursor, e: dur })
blocks.forEach((b) => (b.d = b.e - b.s))
// a click at the start, a chair in a long pause: short, alone, not speech
const dropped = blocks.filter((b, i) => b.d < 0.2 || (b.d < 0.6 && (i === 0 || b.s - blocks[i - 1].e > 1.5) && (i === blocks.length - 1 || blocks[i + 1].s - b.e > 1.5)))
blocks = blocks.filter((b) => !dropped.includes(b))
if (dropped.length) console.log(`ignored ${dropped.length} blip${dropped.length > 1 ? 's' : ''}: ${dropped.map((b) => `${b.s.toFixed(1)}s (${b.d.toFixed(2)}s)`).join(', ')}`)
if (blocks.length < CUES.length) { console.error(`only ${blocks.length} runs of speech for ${CUES.length} cues — lower --gap or raise --noise`); process.exit(1) }

// 3. group consecutive runs into the cues: spoken seconds per cue ∝ its words
const words = CUES.map((c) => c.text.split(/\s+/).filter(Boolean).length)
const spoken = blocks.reduce((s, b) => s + b.d, 0)
const rate = spoken / words.reduce((a, b) => a + b, 0)
const expected = words.map((w) => w * rate)
const n = blocks.length, k = CUES.length
const pre = [0]
for (const b of blocks) pre.push(pre[pre.length - 1] + b.d)
const span = (i, j) => pre[j] - pre[i] // spoken seconds in blocks[i..j)
const INF = Number.POSITIVE_INFINITY
const cost = Array.from({ length: k + 1 }, () => new Array(n + 1).fill(INF))
const from = Array.from({ length: k + 1 }, () => new Array(n + 1).fill(-1))
cost[0][0] = 0
for (let c = 1; c <= k; c++)
  for (let j = c; j <= n; j++)
    for (let i = c - 1; i < j; i++) {
      if (cost[c - 1][i] === INF) continue
      const v = cost[c - 1][i] + (span(i, j) - expected[c - 1]) ** 2 / expected[c - 1]
      if (v < cost[c][j]) { cost[c][j] = v; from[c][j] = i }
    }
const cut = new Array(k + 1)
cut[k] = n
for (let c = k; c >= 1; c--) cut[c - 1] = from[c][cut[c]]
const groups = CUES.map((_, c) => ({ s: blocks[cut[c]].s, e: blocks[cut[c + 1] - 1].e, spoken: span(cut[c], cut[c + 1]), runs: cut[c + 1] - cut[c] }))

// 4. one clip per cue
console.log(`${n} runs of speech, ${spoken.toFixed(1)}s spoken at ${(60 / rate).toFixed(0)} words/min\n`)
console.log('cue              at      take           spoken  expect   len   slot   fit')
let worst = 0
CUES.forEach((c, i) => {
  const g = groups[i]
  const s = Math.max(0, g.s - PAD_IN), e = Math.min(dur, g.e + PAD_OUT), len = e - s
  ff(['-ss', s.toFixed(3), '-t', len.toFixed(3), '-i', TAKE, '-af', `afade=t=in:d=0.04,afade=t=out:st=${(len - 0.12).toFixed(3)}:d=0.12`, '-c:a', 'libmp3lame', '-b:a', '160k', `${OUT}${c.id}.mp3`])
  const over = len - c.slot
  worst = Math.max(worst, over)
  const gapBefore = i ? g.s - groups[i - 1].e : g.s
  console.log(`${c.id.padEnd(16)} ${mmss(c.at).padEnd(7)} ${mmss(g.s)}–${mmss(g.e)} ${`(${g.runs})`.padEnd(5)} ${g.spoken.toFixed(1).padStart(5)}s ${expected[i].toFixed(1).padStart(5)}s ${len.toFixed(1).padStart(5)}s ${String(c.slot).padStart(5)}s  ${over > 0 ? `OVER by ${over.toFixed(1)}s` : `${(-over).toFixed(1)}s spare`}  ·  ${gapBefore.toFixed(1)}s pause before`)
})
console.log(worst > 0 ? `\nworst overrun ${worst.toFixed(1)}s — nudge that cue's picture, or re-record it tighter` : '\neverything fits')
console.log(`\nclips in assets/${OUT_NAME}/ — set VO = 'cues:${OUT_NAME}' in src/edits.ts`)

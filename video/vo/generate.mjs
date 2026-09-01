/**
 * Generate the voice-over with ElevenLabs, one MP3 per cue, into assets/vo/.
 *
 *   ELEVENLABS_API_KEY=… node vo/generate.mjs [--voice George] [--model eleven_multilingual_v2] [--speed 1.0] [--only 07-proof-b]
 *
 * Prints a fit table afterwards: each cue's length against its picture slot.
 * `previous_text`/`next_text` keep prosody continuous across cues.
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { CUES } from './script.mjs'

const KEY = process.env.ELEVENLABS_API_KEY
if (!KEY) { console.error('ELEVENLABS_API_KEY is not set'); process.exit(1) }

const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : dflt }
const VOICE = arg('voice', 'George')
const MODEL = arg('model', 'eleven_multilingual_v2')
const SPEED = Number(arg('speed', '1.0'))
const ONLY = arg('only', null)
const OUT = new URL('../assets/vo/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

const H = { 'xi-api-key': KEY }

// resolve a voice by name (or accept a raw voice_id)
async function resolveVoice(nameOrId) {
  const r = await fetch('https://api.elevenlabs.io/v1/voices', { headers: H })
  if (!r.ok) throw new Error(`voices: ${r.status} ${await r.text()}`)
  const { voices } = await r.json()
  const hit = voices.find(v => v.voice_id === nameOrId) ?? voices.find(v => v.name.toLowerCase().split(' - ')[0] === nameOrId.toLowerCase())
  if (!hit) { console.error('voice not found; available:', voices.map(v => `${v.name} (${v.labels?.accent ?? ''})`).join(', ')); process.exit(1) }
  return hit
}

// strip the punctuation that only helps a human reader
const forEar = s => s.replace(/…/g, '...').replace(/\s+/g, ' ').trim()

const secs = f => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim())

const voice = await resolveVoice(VOICE)
console.log(`voice: ${voice.name} (${voice.voice_id}) · model: ${MODEL} · speed: ${SPEED}\n`)

for (let i = 0; i < CUES.length; i++) {
  const c = CUES[i]
  const file = `${OUT}${c.id}.mp3`
  if (ONLY && c.id !== ONLY) continue
  if (!ONLY && existsSync(file) && process.argv.includes('--keep')) continue
  const body = {
    text: forEar(c.text),
    model_id: MODEL,
    previous_text: i > 0 ? forEar(CUES[i - 1].text) : undefined,
    next_text: i < CUES.length - 1 ? forEar(CUES[i + 1].text) : undefined,
    voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true, speed: SPEED },
  }
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice.voice_id}?output_format=mp3_44100_128`, {
    method: 'POST', headers: { ...H, 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, body: JSON.stringify(body),
  })
  if (!r.ok) { console.error(`${c.id}: ${r.status} ${await r.text()}`); process.exit(1) }
  writeFileSync(file, Buffer.from(await r.arrayBuffer()))
  process.stdout.write(`${c.id} ✓\n`)
}

// fit table
console.log('\ncue              at      len   slot   fit')
let worst = 0
for (const c of CUES) {
  const file = `${OUT}${c.id}.mp3`
  if (!existsSync(file)) continue
  const len = secs(file)
  const over = len - c.slot
  worst = Math.max(worst, over)
  const mmss = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`
  console.log(`${c.id.padEnd(16)} ${mmss(c.at).padEnd(7)} ${len.toFixed(1).padStart(5)}s ${String(c.slot).padStart(5)}s  ${over > 0 ? `OVER by ${over.toFixed(1)}s` : `${(-over).toFixed(1)}s spare`}`)
}
console.log(worst > 0 ? `\nworst overrun ${worst.toFixed(1)}s — nudge the picture or re-run that cue with --speed 1.05` : '\neverything fits')

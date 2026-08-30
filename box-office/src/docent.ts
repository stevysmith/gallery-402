/**
 * The museum's own docent. Given an artwork and where the visitor clicked,
 * it looks at the actual image and says what is there — returning a short
 * answer and a tight region so the gallery can spotlight it.
 *
 * Enabled when ANTHROPIC_API_KEY is set. Answers are cached per (artwork,
 * spot, question) and rate-limited per IP.
 */
import Anthropic from '@anthropic-ai/sdk'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Artwork } from './collection.js'

export type DocentAnswer = { answer: string; region: { x: number; y: number; w: number; h: number } | null; cached?: boolean }

const SYSTEM = `You are the docent at Gallery 402, a small virtual museum of public-domain masterworks. A visitor is standing in front of one artwork and has clicked a spot on it; you are given the image, the museum's label, and the click position as fractions of the image (x from the left, y from the top).

Say what is at that spot and one thing worth knowing about it — two or three sentences, warm and specific, as if speaking beside them. No preamble, no "at that spot you clicked". If the visitor asked a question, answer it. If the click lands on something plain (bare wall, sky), say so briefly and point to the nearest thing worth looking at.

Then give a tight bounding box around what you described, as fractions of the image.

Respond with JSON only, no code fences:
{"answer": "...", "region": {"x": 0.12, "y": 0.4, "w": 0.3, "h": 0.25}}`

export function createDocent(opts: { apiKey?: string; artDir: string; model?: string }) {
  if (!opts.apiKey) return null
  const client = new Anthropic({ apiKey: opts.apiKey })
  const model = opts.model ?? 'claude-opus-5'
  const cache = new Map<string, DocentAnswer>()
  const perIp = new Map<string, { n: number; since: number }>()
  const DAY = 24 * 60 * 60 * 1000

  return {
    async ask(art: Artwork, x: number, y: number, question: string | undefined, ip: string): Promise<DocentAnswer | { error: string; status: 429 | 502 }> {
      const rec = perIp.get(ip) ?? { n: 0, since: Date.now() }
      if (Date.now() - rec.since > DAY) Object.assign(rec, { n: 0, since: Date.now() })
      if (rec.n >= 60) return { error: 'The docent has answered a lot of questions from this network today. Try again tomorrow.', status: 429 }

      const key = `${art.id}:${Math.round(x * 25)}:${Math.round(y * 25)}:${(question ?? '').trim().toLowerCase()}`
      const hit = cache.get(key)
      if (hit) return { ...hit, cached: true }

      const image = await readFile(path.join(opts.artDir, path.basename(art.file)))
      const label = `${art.title} — ${art.artist}, ${art.date}. ${art.medium}. ${art.museum}.\nCurator's note: ${art.note}`
      const where = `The visitor clicked at x=${x.toFixed(2)}, y=${y.toFixed(2)} (${Math.round(x * 100)}% from the left, ${Math.round(y * 100)}% from the top).`
      const ask = question?.trim() ? `Their question: "${question.trim()}"` : 'They want to know what that is.'

      rec.n += 1
      perIp.set(ip, rec)

      const res = await client.beta.messages.create({
        model,
        max_tokens: 1024,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low' },
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image.toString('base64') } },
              { type: 'text', text: `${label}\n\n${where}\n${ask}` },
            ],
          },
        ],
      })
      if (res.stop_reason === 'refusal') return { error: 'The docent declined to answer that one.', status: 502 }
      const text = res.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map((b) => b.text).join('').trim()
      const parsed = parseAnswer(text)
      cache.set(key, parsed)
      return parsed
    },
  }
}

function parseAnswer(text: string): DocentAnswer {
  const body = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    const j = JSON.parse(body)
    const r = j.region
    const region =
      r && ['x', 'y', 'w', 'h'].every((k) => typeof r[k] === 'number')
        ? { x: clamp(r.x), y: clamp(r.y), w: Math.max(0.02, clamp(r.w)), h: Math.max(0.02, clamp(r.h)) }
        : null
    return { answer: String(j.answer ?? '').trim() || body, region }
  } catch {
    return { answer: body, region: null }
  }
}
const clamp = (v: number) => Math.min(1, Math.max(0, v))

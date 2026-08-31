/**
 * Model-driven evals: a real LLM is the agent. It sees exactly what a WebMCP
 * browser sees (the live tool list from document.modelContext, re-read every
 * turn because the surface changes), decides what to call, and the harness
 * executes it on the page. Then we judge calls + final page state.
 *
 *   ANTHROPIC_API_KEY=… npm run eval:llm            (from gallery/)
 *   EVAL_MODEL=claude-opus-5 … to change the model
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { withHarness, openVisitor, callTool, listTools, getCalls, getState, parseStep, judge, PREFIX } from './harness.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const cases = JSON.parse(fs.readFileSync(path.join(HERE, 'cases.json'), 'utf8'))
const only = process.argv[2]
const KEY = process.env.ANTHROPIC_API_KEY
const MODEL = process.env.EVAL_MODEL ?? 'claude-sonnet-5'
if (!KEY) {
  console.error('Set ANTHROPIC_API_KEY to run model-driven evals.')
  process.exit(2)
}

const SYSTEM = `You are the visitor's agent inside their web browser, on a page called Gallery 402 — a virtual museum whose box office is exposed as page tools.
Use the tools to do what the visitor asks. Act; don't ask clarifying questions. Read-only tools are free to call. Paying tools (buy_ticket) spend the visitor's money — buy only what the request needs, and prefer the cheapest option that satisfies it. If a tool reports an error, read it and adjust. When the request is satisfied, reply with one short sentence.`

async function claude(messages, tools) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 1024, system: SYSTEM, tools, messages }),
  })
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0, 300)}`)
  return r.json()
}

const toAnthropicTools = (tools) =>
  tools.map((t) => ({
    name: t.name,
    description: t.description ?? '',
    input_schema: t.inputSchema ? { type: 'object', properties: t.inputSchema.properties ?? {}, required: t.inputSchema.required ?? [] } : { type: 'object', properties: {} },
  }))

const results = await withHarness(async ({ browser, url }) => {
  const out = []
  for (const c of cases) {
    if (only && c.id !== only) continue
    // Contract cases assert on exact error texts via scripted calls — they are
    // not natural-language asks, so a live model is the wrong driver for them.
    if (c.scriptedOnly) continue
    const t0 = Date.now()
    const { context, page } = await openVisitor(browser, url, { policy: c.policy })
    let failures = []
    let lastResult = null
    const trace = []
    try {
      for (const step of c.setup ?? []) {
        const { name, params } = parseStep(step)
        const r = await callTool(page, name, params)
        if (r.isError) throw new Error(`setup ${step} failed: ${r.text}`)
      }
      for (const h of c.human ?? []) {
        if (h.click && h.position) {
          const el = await page.$(h.click)
          const box = await el.boundingBox()
          await page.mouse.click(box.x + box.width * h.position.x, box.y + box.height * h.position.y)
        } else if (h.click) await page.click(h.click)
        await page.waitForTimeout(150)
      }
      await page.evaluate(() => (window.__mcp.calls.length = 0))
      const messages = [{ role: 'user', content: c.prompt }]
      for (let turn = 0; turn < 10; turn++) {
        const tools = toAnthropicTools(await listTools(page)) // re-read: the surface changes
        const res = await claude(messages, tools)
        messages.push({ role: 'assistant', content: res.content })
        const uses = res.content.filter((b) => b.type === 'tool_use')
        if (!uses.length || res.stop_reason === 'end_turn') {
          trace.push({ say: res.content.filter((b) => b.type === 'text').map((b) => b.text).join(' ') })
          break
        }
        const resultsBlock = []
        for (const u of uses) {
          const r = await callTool(page, u.name, u.input, { approval: c.approval })
          lastResult = r
          trace.push({ call: u.name.replace(PREFIX, ''), params: u.input, ok: !r.isError })
          resultsBlock.push({ type: 'tool_result', tool_use_id: u.id, content: r.text, is_error: r.isError || undefined })
        }
        messages.push({ role: 'user', content: resultsBlock })
      }
      await page.waitForTimeout(300)
      failures = judge(c, await getCalls(page), await getState(page), lastResult)
    } catch (e) {
      failures = [e.message]
    }
    await context.close()
    const ms = Date.now() - t0
    out.push({ id: c.id, prompt: c.prompt, ok: failures.length === 0, failures, trace, ms })
    const path_ = trace.filter((t) => t.call).map((t) => `${t.call}${t.params && Object.keys(t.params).length ? `(${Object.values(t.params).join(',')})` : ''}`).join(' → ')
    console.log(`${failures.length ? '✗' : '✓'} ${c.id.padEnd(26)} ${String(ms).padStart(6)}ms  ${path_ || '(no tools)'}${failures.length ? '\n    - ' + failures.join('\n    - ') : ''}`)
  }
  return out
})

const passed = results.filter((r) => r.ok).length
console.log(`\n${passed}/${results.length} model-driven evals passed (${MODEL})`)
fs.mkdirSync(path.join(HERE, 'results'), { recursive: true })
fs.writeFileSync(path.join(HERE, 'results', `llm-${MODEL}-${Date.now()}.json`), JSON.stringify(results, null, 2))
process.exit(passed === results.length ? 0 : 1)

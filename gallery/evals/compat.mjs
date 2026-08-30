/**
 * ChatGPT / Chrome compatibility check.
 *
 * Asserts the page satisfies the documented subset ChatGPT's in-app browser
 * supports, plus Chrome's published budgets for tool descriptions and output.
 * Sources: learn.chatgpt.com/docs/webmcp (site tools) and
 * developer.chrome.com/docs/ai/webmcp/{secure-tools,build-tools}.
 *
 *   npm run compat
 */
import { withHarness, openVisitor, callTool, listTools, PREFIX } from './harness.mjs'

const BUDGET = { name: 30, description: 500, paramDescription: 150, output: 1500 }
const problems = []
const notes = []
const fail = (m) => problems.push(m)
const ok = (m) => notes.push(`✓ ${m}`)

await withHarness(async ({ browser, url }) => {
  const { context, page } = await openVisitor(browser, url)

  // 1. Registration must be on document.modelContext (ChatGPT reads that), in the top-level page.
  const surface = await page.evaluate(() => ({
    doc: typeof document.modelContext,
    nav: typeof navigator.modelContext,
    frames: window.frames.length,
    declarativeForms: document.querySelectorAll('[toolname], [tooldescription]').length,
  }))
  surface.doc === 'object' ? ok('tools register on document.modelContext') : fail('tools are not on document.modelContext — ChatGPT will not see them')
  if (surface.frames > 0) fail(`page has ${surface.frames} iframe(s); ChatGPT does not discover tools inside iframes`)
  else ok('no iframes — nothing hidden from ChatGPT')
  if (surface.declarativeForms > 0) fail('declarative form tools found; ChatGPT supports only the JavaScript API')
  else ok('no declarative-API tools (unsupported in ChatGPT)')

  // 2. Budgets on every tool, in every state the surface can reach.
  const states = [
    { label: 'lobby, no tickets', setup: [] },
    { label: 'in a wing with a tour running', setup: [{ call: 'take_tour', params: { tour: 'light' } }, { call: 'start_tour' }] },
  ]
  const seen = new Map()
  for (const st of states) {
    const { context: c2, page: p2 } = st.setup.length ? await openVisitor(browser, url) : { context: null, page }
    for (const s of st.setup) await callTool(p2, s.call, s.params)
    await p2.waitForTimeout(400)
    for (const t of await listTools(p2)) if (!seen.has(t.name)) seen.set(t.name, t)
    if (c2) await c2.close()
  }
  ok(`${seen.size} distinct tools across ${states.length} page states`)

  for (const t of seen.values()) {
    const bare = t.name.replace(PREFIX, '')
    if (t.name.length > BUDGET.name) fail(`name too long (${t.name.length} > ${BUDGET.name}): ${t.name}`)
    if (!/^[a-zA-Z0-9_-]+$/.test(t.name)) fail(`name has characters agents may not quote safely: ${t.name}`)
    const d = (t.description ?? '').length
    if (!d) fail(`${bare}: no description`)
    if (d > BUDGET.description) fail(`${bare}: description ${d} chars > ${BUDGET.description}`)
    const props = t.inputSchema?.properties ?? {}
    for (const [k, p] of Object.entries(props)) {
      const pd = (p.description ?? '').length
      if (!pd) fail(`${bare}.${k}: parameter has no description`)
      if (pd > BUDGET.paramDescription) fail(`${bare}.${k}: parameter description ${pd} > ${BUDGET.paramDescription}`)
    }
    if (t.inputSchema) {
      const raw = JSON.stringify(t.inputSchema)
      if (raw.includes('$ref')) fail(`${bare}: schema uses $ref, which not every agent resolves`)
      if (t.inputSchema.type !== 'object') fail(`${bare}: input schema root must be an object`)
    }
  }

  // 2b. The panel shown to the human must match the surface given to the agent.
  await page.click('.pill')
  await page.waitForSelector('.surface')
  await page.waitForTimeout(600)
  const shown = await page.$$eval('.surface-row:not(.is-leaving) .surface-name', (els) => els.map((e) => e.textContent))
  const registered = (await listTools(page)).map((t) => t.name.replace(PREFIX, ''))
  const missing = registered.filter((n) => !shown.includes(n))
  const extra = shown.filter((n) => !registered.includes(n))
  if (missing.length || extra.length) fail(`the "what your agent can do" panel disagrees with the registered surface (missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'})`)
  else ok(`human-visible surface matches the ${registered.length} registered tools`)

  // 3. Read-only tools must return serializable output inside the output budget.
  const readOnly = [...seen.values()].filter((t) => t.annotations?.readOnlyHint)
  ok(`${readOnly.length} tools annotated readOnlyHint`)
  const { context: c3, page: p3 } = await openVisitor(browser, url)
  await callTool(p3, 'take_tour', { tour: 'light' })
  await callTool(p3, 'start_tour')
  for (const t of readOnly) {
    const bare = t.name.replace(PREFIX, '')
    const r = await callTool(p3, bare, {}).catch((e) => ({ isError: true, text: String(e.message) }))
    if (r.isError) {
      notes.push(`· ${bare} returned an error in this state (fine if it needs arguments)`)
      continue
    }
    const size = r.text.length
    if (size > BUDGET.output) fail(`${bare}: returns ${size} chars > ${BUDGET.output} budget — trim it or paginate`)
    else ok(`${bare} output ${size} chars`)
    try {
      JSON.parse(r.text)
    } catch {
      notes.push(`· ${bare} returns plain text (valid, just not JSON)`)
    }
  }
  await c3.close()
  await context.close()
})

console.log('\nChatGPT / Chrome compatibility')
console.log('─'.repeat(60))
for (const n of notes) console.log(' ', n)
if (problems.length) {
  console.log('\nProblems:')
  for (const p of problems) console.log('  ✗', p)
} else {
  console.log('\nNo problems found.')
}
process.exit(problems.length ? 1 : 0)

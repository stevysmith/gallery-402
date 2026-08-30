/**
 * Scripted evals: replay each case's expected tool sequence through the fake
 * WebMCP surface and check the page ends up where an agent would need it.
 * Proves the tools compose, the surface changes with state, and payments,
 * approvals and errors round-trip. No model involved.
 *
 *   npm run eval            (from gallery/)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { withHarness, openVisitor, callTool, getCalls, getState, parseStep, judge } from './harness.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const cases = JSON.parse(fs.readFileSync(path.join(HERE, 'cases.json'), 'utf8'))
const only = process.argv[2]

const results = await withHarness(async ({ browser, url }) => {
  const out = []
  for (const c of cases) {
    if (only && c.id !== only) continue
    const t0 = Date.now()
    const { context, page } = await openVisitor(browser, url, { policy: c.policy })
    let failures = []
    let lastResult = null
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
      const steps = c.scripted ?? c.expect.calls
      for (const step of steps) {
        const { name, params } = parseStep(step)
        lastResult = await callTool(page, name, params, { approval: c.approval })
      }
      await page.waitForTimeout(300)
      failures = judge(c, await getCalls(page), await getState(page), lastResult)
    } catch (e) {
      failures = [e.message]
    }
    await context.close()
    const ms = Date.now() - t0
    out.push({ id: c.id, ok: failures.length === 0, failures, ms })
    console.log(`${failures.length ? '✗' : '✓'} ${c.id.padEnd(26)} ${String(ms).padStart(5)}ms${failures.length ? '\n    - ' + failures.join('\n    - ') : ''}`)
  }
  return out
})

const passed = results.filter((r) => r.ok).length
console.log(`\n${passed}/${results.length} scripted evals passed`)
fs.mkdirSync(path.join(HERE, 'results'), { recursive: true })
fs.writeFileSync(path.join(HERE, 'results', `scripted-${Date.now()}.json`), JSON.stringify(results, null, 2))
process.exit(passed === results.length ? 0 : 1)

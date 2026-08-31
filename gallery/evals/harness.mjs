/**
 * Eval harness for Gallery 402's WebMCP tools.
 *
 * Boots the box office in X402_MODE=mock (real 402/PAYMENT-* headers, no chain),
 * serves the gallery, and opens it in headless Chromium with a fake
 * `document.modelContext` that records every registerTool / executeTool —
 * i.e. it plays the browser's agent surface so tests can act like an agent.
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const GALLERY = path.resolve(HERE, '..')
const BOX_OFFICE = path.resolve(HERE, '..', '..', 'box-office')
export const PREFIX = 'gallery_'

const BOX_PORT = Number(process.env.EVAL_BOX_PORT ?? 4412)
const WEB_PORT = Number(process.env.EVAL_WEB_PORT ?? 4413)

const waitFor = async (url, ms = 30000) => {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    try {
      const r = await fetch(url)
      if (r.ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`timed out waiting for ${url}`)
}

export async function startServers() {
  const box = spawn('npx', ['tsx', 'src/index.ts'], {
    cwd: BOX_OFFICE,
    env: { ...process.env, PORT: String(BOX_PORT), X402_MODE: 'mock', TICKET_SECRET: 'eval-secret', TREASURY_PRIVATE_KEY: '', ANTHROPIC_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const web = spawn('npx', ['vite', '--port', String(WEB_PORT), '--strictPort', '--clearScreen', 'false'], {
    cwd: GALLERY,
    env: { ...process.env, VITE_BOX_OFFICE_URL: `http://localhost:${BOX_PORT}` },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const logs = { box: '', web: '' }
  box.stdout.on('data', (d) => (logs.box += d))
  box.stderr.on('data', (d) => (logs.box += d))
  web.stdout.on('data', (d) => (logs.web += d))
  web.stderr.on('data', (d) => (logs.web += d))
  try {
    await waitFor(`http://localhost:${BOX_PORT}/health`)
    await waitFor(`http://localhost:${WEB_PORT}/`)
  } catch (e) {
    box.kill()
    web.kill()
    throw new Error(`${e.message}\n--- box office ---\n${logs.box}\n--- gallery ---\n${logs.web}`)
  }
  return {
    url: `http://localhost:${WEB_PORT}/`,
    boxOffice: `http://localhost:${BOX_PORT}`,
    stop() {
      box.kill()
      web.kill()
    },
  }
}

/** The fake WebMCP surface, installed before any page script runs. */
const FAKE_MODEL_CONTEXT = `
(() => {
  const tools = new Map(); const calls = []; const events = []; let inflight = 0; const violations = [];
  // Chrome < 153 aborts an execution when its tool is unregistered mid-call. The fake
  // records that as a violation so the evals catch pages that change their surface
  // inside a tool call.
  const mc = {
    registerTool(t, opts) {
      tools.set(t.name, t); events.push({ type: 'register', name: t.name });
      if (inflight > 0) violations.push('register ' + t.name + ' during a call');
      opts && opts.signal && opts.signal.addEventListener('abort', () => { if (tools.get(t.name) === t) { tools.delete(t.name); events.push({ type: 'abort', name: t.name }); if (inflight > 0) violations.push('abort ' + t.name + ' during a call'); } });
      return Promise.resolve();
    },
    unregisterTool(name) { tools.delete(name); events.push({ type: 'unregister', name }); if (inflight > 0) violations.push('unregister ' + name + ' during a call'); },
    getTools() { return Promise.resolve([...tools.values()].map(t => ({ name: t.name, title: t.title, description: t.description, inputSchema: t.inputSchema, annotations: t.annotations }))); },
    async executeTool(name, input) {
      const t = tools.get(name); if (!t) throw new Error('No such tool: ' + name);
      const params = typeof input === 'string' ? JSON.parse(input || '{}') : (input || {});
      const rec = { name, params, at: Date.now() }; calls.push(rec);
      inflight++;
      try {
        const result = await t.execute(params, { signal: new AbortController().signal });
        rec.result = result; return result;
      } finally { inflight--; }
    },
  };
  Object.defineProperty(document, 'modelContext', { value: mc, configurable: true });
  window.__mcp = { tools, calls, events, violations };
})();`

export async function openVisitor(browser, url, { policy } = {}) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  await context.addInitScript(FAKE_MODEL_CONTEXT)
  if (policy) await context.addInitScript((p) => localStorage.setItem('g402.policy', JSON.stringify(p)), { autoApproveUpToUsd: 0.05, askEveryTime: false, ...policy })
  const page = await context.newPage()
  page.on('pageerror', (e) => console.error('  [page error]', e.message))
  await page.goto(url)
  await page.waitForFunction(() => window.__mcp && window.__mcp.tools.size > 0 && document.querySelector('.board'), null, { timeout: 20000 })
  return { context, page }
}

export const listTools = (page) => page.evaluate(() => [...window.__mcp.tools.values()].map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema, annotations: t.annotations })))

/**
 * Execute a tool the way an agent would (through document.modelContext) and
 * optionally answer the approval sheet if the visitor's policy pops it.
 */
export async function callTool(page, name, params = {}, { approval } = {}) {
  const full = name.startsWith(PREFIX) ? name : PREFIX + name
  const exec = page.evaluate(([n, p]) => document.modelContext.executeTool(n, JSON.stringify(p)), [full, params])
  let settled = false
  const done = exec.then((r) => ((settled = true), r), (e) => ((settled = true), Promise.reject(e)))
  done.catch(() => {}) // handled below via `await done`; this just stops Node flagging an early rejection as unhandled
  // watch for the box-office approval window while the call is in flight
  for (let i = 0; i < 100 && !settled; i++) {
    await new Promise((r) => setTimeout(r, 100))
    const sheet = await page.$('.window')
    if (sheet) {
      await page.click(approval === 'decline' ? '.window .btn-ghost' : '.window .btn-brass')
      break
    }
  }
  const raw = await done
  // A tool call can change what tools exist (buying a ticket reveals enter_wing;
  // any action reveals undo). agentk defers that re-registration until the call
  // has returned, so give the surface a beat to settle — a real agent re-reads
  // getTools() between turns and never sees the gap.
  await page.waitForTimeout(90)
  return parseResult(raw)
}

export function parseResult(raw) {
  if (raw && raw.content && raw.content[0] && typeof raw.content[0].text === 'string') {
    let data
    try {
      data = JSON.parse(raw.content[0].text)
    } catch {
      data = raw.content[0].text
    }
    return { isError: !!raw.isError, data, text: raw.content[0].text }
  }
  return { isError: false, data: raw, text: JSON.stringify(raw) }
}

export const getCalls = (page) => page.evaluate(() => window.__mcp.calls.map((c) => ({ name: c.name, params: c.params, isError: !!(c.result && c.result.isError) })))

export const getState = (page) =>
  page.evaluate(() => {
    const app = document.querySelector('.app')
    const frame = document.querySelector('.frame.is-active') || document.querySelector('.frame')
    let tickets = []
    try {
      tickets = Object.keys(JSON.parse(localStorage.getItem('g402.tickets') || '{}'))
    } catch {}
    const tour = document.querySelector('.tour')
    const cmp = document.querySelector('.compare')
    return {
      wing: app ? app.dataset.wing : null,
      screen: app ? app.dataset.screen : null,
      artwork: frame ? frame.dataset.artwork : null,
      index: frame ? Number(frame.dataset.index) : null,
      spotlight: frame ? frame.dataset.spotlight ?? null : null,
      docent: !!document.querySelector('[data-docent]'),
      pin: !!document.querySelector('.pin'),
      compare: cmp ? cmp.dataset.compare : null,
      tour: tour ? { status: tour.dataset.tourStatus, cursor: Number(tour.dataset.tourCursor), stops: document.querySelectorAll('.tour-stop').length } : null,
      tickets,
      stubs: document.querySelectorAll('.stub').length,
      tools: [...window.__mcp.tools.keys()],
      violations: window.__mcp.violations.slice(),
    }
  })

/** "buy_ticket:van-gogh" → { name: 'buy_ticket', params: { wing: 'van-gogh' } }; objects { call, params } pass through. */
const PARAM_KEY = { buy_ticket: 'wing', enter_wing: 'wing', view_artwork: 'query', walk: 'direction', tour_step: 'direction', spotlight: 'artwork' }
export function parseStep(step) {
  if (typeof step === 'object') return { name: step.call, params: step.params ?? {} }
  const [name, ...rest] = step.split(':')
  const value = rest.join(':')
  const key = PARAM_KEY[name]
  return { name, params: value && key ? { [key]: value } : {} }
}

/** Compare recorded calls + final state against a case's expectations. */
export function judge(c, calls, state, lastResult) {
  const exp = c.expect ?? {}
  const failures = []
  const names = calls.map((x) => x.name.replace(PREFIX, ''))
  const matches = (rec, want) => {
    const { name, params } = parseStep(want)
    if (rec.name.replace(PREFIX, '') !== name) return false
    for (const [k, v] of Object.entries(params)) {
      const got = String(rec.params?.[k] ?? '')
      if (name === 'view_artwork' ? !got.toLowerCase().includes(v.toLowerCase()) : got !== v) return false
    }
    return true
  }
  // required calls, in order (other calls may interleave)
  let cursor = 0
  for (const want of exp.calls ?? []) {
    let found = -1
    for (let i = cursor; i < calls.length; i++) if (matches(calls[i], want)) { found = i; break }
    if (found < 0) failures.push(`missing call ${want} (got: ${names.join(' → ') || 'none'})`)
    else cursor = found + 1
  }
  for (const f of exp.forbid ?? []) if (names.includes(f)) failures.push(`forbidden call ${f} was made`)
  if (exp.maxPayments != null) {
    const n = names.filter((x) => x === 'buy_ticket').length
    if (n > exp.maxPayments) failures.push(`${n} buy_ticket calls, max ${exp.maxPayments}`)
  }
  const st = exp.state ?? {}
  if (st.wing && state.wing !== st.wing) failures.push(`expected wing ${st.wing}, page shows ${state.wing}`)
  if (st.artwork && state.artwork !== st.artwork) failures.push(`expected artwork ${st.artwork}, page shows ${state.artwork}`)
  if (st.index != null && state.index !== st.index) failures.push(`expected index ${st.index}, page shows ${state.index}`)
  if (st.screen && state.screen !== st.screen) failures.push(`expected screen ${st.screen}, page shows ${state.screen}`)
  if (st.spotlight != null && !!state.spotlight !== !!st.spotlight) failures.push(`expected spotlight ${st.spotlight ? 'on' : 'off'}, page shows ${state.spotlight ? 'on' : 'off'}`)
  if (st.docent != null && state.docent !== st.docent) failures.push(`expected docent note ${st.docent ? 'shown' : 'hidden'}`)
  if (st.compare && state.compare !== st.compare) failures.push(`expected compare ${st.compare}, page shows ${state.compare}`)
  if (st.tour) {
    if (!state.tour) failures.push('expected a tour panel')
    else {
      if (st.tour.status && state.tour.status !== st.tour.status) failures.push(`expected tour ${st.tour.status}, panel shows ${state.tour.status}`)
      if (st.tour.cursor != null && state.tour.cursor !== st.tour.cursor) failures.push(`expected tour cursor ${st.tour.cursor}, panel shows ${state.tour.cursor}`)
      if (st.tour.stops != null && state.tour.stops !== st.tour.stops) failures.push(`expected ${st.tour.stops} stops, panel shows ${state.tour.stops}`)
    }
  }
  if (st.tour === null && state.tour) failures.push('expected no tour panel')
  if (state.violations && state.violations.length) failures.push(`tool surface changed during a call (Chrome <153 would abort it): ${state.violations.join('; ')}`)
  if (st.tickets) {
    const have = [...state.tickets].sort().join(',')
    const want = [...st.tickets].sort().join(',')
    if (have !== want) failures.push(`expected tickets [${want}], have [${have}]`)
  }
  for (const t of exp.toolsPresent ?? []) if (!state.tools.includes(PREFIX + t)) failures.push(`tool ${t} should be registered now`)
  for (const t of exp.toolsAbsent ?? []) if (state.tools.includes(PREFIX + t)) failures.push(`tool ${t} should NOT be registered now`)
  if (exp.lastResultIsError && !(lastResult && lastResult.isError)) failures.push('expected the last tool result to carry isError')
  for (const want of [exp.lastResultIncludes ?? []].flat())
    if (!(lastResult && lastResult.text.includes(want))) failures.push(`expected the last tool result to mention "${want}"`)
  return failures
}

export async function withHarness(fn) {
  const servers = await startServers()
  const browser = await chromium.launch()
  try {
    return await fn({ browser, ...servers })
  } finally {
    await browser.close()
    servers.stop()
  }
}

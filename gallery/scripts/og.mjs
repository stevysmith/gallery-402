// Renders scripts/og.html to ../box-office/public/og.png (1200×630).
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
const HERE = path.dirname(fileURLToPath(import.meta.url))
const out = path.resolve(HERE, '..', '..', 'box-office', 'public', 'og.png')
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
await page.goto('file://' + path.join(HERE, 'og.html'))
await page.waitForLoadState('networkidle')
await page.evaluate(() => document.fonts.ready)
await page.screenshot({ path: out, type: 'png' })
await browser.close()
console.log('wrote', out)

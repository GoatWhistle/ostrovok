import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { writeFileSync } from 'node:fs'
const require = createRequire(resolve('frontend/package.json'))
const { chromium } = require('@playwright/test')
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const started = Date.now(), requests = [], responses = [], errors = []
page.on('request', r => { if (r.url().includes('/map/')) requests.push({ path: new URL(r.url()).pathname, ms: Date.now()-started }) })
page.on('response', r => { if (r.url().includes('/map/')) responses.push({ path: new URL(r.url()).pathname, status: r.status(), ms: Date.now()-started }) })
page.on('pageerror', e => errors.push(String(e)))
await page.goto('http://127.0.0.1:8080', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(10000)
const report = { requests, responses, errors }
writeFileSync(`work/evals/map-${process.argv[2] ?? 'before'}.json`, JSON.stringify(report, null, 2))
console.log(JSON.stringify({ requests: requests.length, responses: responses.length, first: responses.find(r => r.status === 200), errors }))
await browser.close()

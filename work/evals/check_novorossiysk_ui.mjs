import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { writeFileSync } from 'node:fs'
const require = createRequire(resolve('frontend/package.json'))
const { chromium } = require('@playwright/test')
const browser = await chromium.launch({ headless: true })
const reports = []
try {
  for (const width of [1440, 375]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' })
    const errors = []
    let calls = 0
    page.on('pageerror', e => errors.push(String(e)))
    page.on('request', r => { if (r.method() === 'POST' && r.url().includes('/chat/messages')) calls++ })
    await page.addInitScript(() => {
      localStorage.setItem('app-locale', 'ru')
      localStorage.setItem('app-theme', 'light')
      localStorage.setItem('hotel-agent-conversation', '9e98647c-333b-4e8a-a0b1-3150b19d4169')
    })
    await page.goto('http://127.0.0.1:8080')
    if (width < 1024) await page.getByRole('radio', { name: 'Отели', exact: true }).check()
    await page.getByRole('button', { name: 'Капиталъ', exact: true }).first().click()
    const property = page.locator('article').getByRole('button', { name: /с рестораном/ }).first()
    await property.hover()
    const response = page.waitForResponse(r => r.url().includes('/facts/f_derived'))
    await property.click()
    const fact = await response
    assert.equal(fact.status(), 200)
    await page.locator('article').getByText('с рестораном', { exact: true }).first().waitFor()
    assert.equal((await page.locator('article').innerText()).includes('derived:'), false)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
    assert.equal(overflow, false)
    assert.deepEqual(errors, [])
    assert.equal(calls, 0)
    const screenshot = `work/evals/novorossiysk-ui-${width}.png`
    await page.screenshot({ path: screenshot })
    reports.push({ width, selected: 'Капиталъ', factStatus: fact.status(), errors, overflow, modelCalls: calls, screenshot })
    console.log('PASS', width, 'hotel and source detail')
    await page.close()
  }
} finally {
  await browser.close()
  writeFileSync('work/evals/novorossiysk-ui-check.json', JSON.stringify(reports, null, 2) + '\n')
}

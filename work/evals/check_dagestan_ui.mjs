import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
const require = createRequire(resolve('frontend/package.json'))
const { chromium } = require('@playwright/test')
const browser = await chromium.launch({ headless: true })
const reports = []
try {
  for (const width of [1440, 375]) {
    for (const theme of ['light', 'dark']) {
      for (const locale of ['ru', 'en']) {
        const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' })
        const errors = []
        let modelCalls = 0
        page.on('pageerror', error => errors.push(String(error)))
        page.on('request', request => {
          if (request.method() === 'POST' && request.url().includes('/chat/messages')) modelCalls++
        })
        const copy = JSON.parse(readFileSync(`frontend/src/shared/i18n/locales/${locale}/explore.json`))
        await page.addInitScript(({ theme, locale }) => {
          localStorage.setItem('app-theme', theme)
          localStorage.setItem('app-locale', locale)
          localStorage.setItem('hotel-agent-conversation', '29180a98-3251-4367-ae43-107698605da3')
        }, { theme, locale })
        await page.goto('http://127.0.0.1:8080')
        if (width < 1024) await page.getByRole('radio', { name: copy.panel.hotels, exact: true }).check()
        await page.getByRole('button', { name: 'гостевой дом "Хидиб"', exact: true }).first().click()
        if (width < 1024) await page.getByRole('radio', { name: copy.panel.map, exact: true }).check()
        await page.waitForSelector('canvas.maplibregl-canvas')
        await page.waitForTimeout(900)
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
        const screenshot = `work/evals/dagestan-ui-${width}-${theme}-${locale}.png`
        await page.screenshot({ path: screenshot })
        assert.equal(overflow, false)
        assert.deepEqual(errors, [])
        assert.equal(modelCalls, 0)
        reports.push({ width, theme, locale, selected: 'гостевой дом "Хидиб"', errors, overflow, modelCalls, screenshot })
        console.log('PASS', width, theme, locale)
        await page.close()
      }
    }
  }
} finally {
  writeFileSync('work/evals/dagestan-ui-check.json', JSON.stringify(reports, null, 2) + '\n')
  await browser.close()
}

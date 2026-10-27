const fs = require('node:fs')
const assert = require('node:assert/strict')
const { chromium } = require('/home/ikhail_horokhorin/projects/o-hack-sochi/frontend/node_modules/playwright')
const root = '/home/ikhail_horokhorin/projects/o-hack-sochi'
const out = '/tmp/evolution-h05'
fs.mkdirSync(out, { recursive: true })
async function run() {
  const browser = await chromium.launch({ headless: true })
  const rows = []
  try {
    for (const width of [375, 1440, 2560]) for (const font of [100, 125]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' })
      await page.addInitScript(() => { localStorage.setItem('app-locale', 'ru'); localStorage.setItem('app-theme', 'dark') })
      const row = { width, font, errors: [] }
      rows.push(row)
      page.on('pageerror', e => row.errors.push(e.message))
      await page.goto('http://127.0.0.1:5179/hotelier/h_demo_typed_check')
      const note = page.getByRole('textbox', { name: 'Пояснение и условия', exact: true })
      await note.waitFor()
      await note.fill('Draft preserved through guest view')
      if (font !== 100) await page.addStyleTag({ content: `html { font-size: ${font}% }` })
      row.headers = await page.locator('h1').allTextContents()
      row.bookingInputs = await page.locator('input[type=date]').count()
      row.overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
      await page.screenshot({ path: `${out}/${width}-${font}.png`, fullPage: true })
      const preview = page.getByRole('button', { name: 'Как видят гости', exact: true })
      await preview.click()
      const dialog = page.getByRole('dialog')
      await dialog.waitFor()
      await dialog.locator('input[type=date]').first().waitFor()
      row.dates = await dialog.locator('input[type=date]').evaluateAll(nodes => nodes.map(e => {
        const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}
      }))
      row.dialogOverflow = await dialog.evaluate(e => e.scrollWidth > e.clientWidth)
      await page.screenshot({ path: `${out}/preview-${width}-${font}.png` })
      await page.keyboard.press('Escape')
      await dialog.waitFor({ state: 'detached' })
      row.focus = await preview.evaluate(e => e === document.activeElement)
      row.draft = await note.inputValue()
      if (width === 375) {
        await page.getByRole('button', { name: /Все вопросы/ }).click()
        const queue = page.getByRole('complementary', { name: 'Вопросы к отелю', exact: true })
        await queue.getByRole('listitem').last().getByRole('button').click()
        row.questionFocus = await page.evaluate(() => document.activeElement?.matches('p[tabindex="-1"]'))
      }
      assert.equal(row.bookingInputs, 0)
      assert.equal(row.overflow, false)
      assert.equal(row.dialogOverflow, false)
      assert.equal(row.focus, true)
      assert.equal(row.draft, 'Draft preserved through guest view')
      assert.equal(row.errors.length, 0)
      assert.equal(row.headers.length, 1)
      console.log(JSON.stringify(row))
      await page.close()
    }
  } finally { fs.writeFileSync(`${out}/results.json`, JSON.stringify(rows, null, 2)); await browser.close() }
}
run().catch(e => { console.error(e); process.exitCode=1 })

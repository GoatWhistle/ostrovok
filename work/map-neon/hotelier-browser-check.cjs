const fs = require("node:fs")
const assert = require("node:assert/strict")
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "/home/ikhail_horokhorin/projects/o-hack/frontend/node_modules/playwright")
const root = "/tmp/o-hack-sochi"
const copy = require(`${root}/frontend/src/shared/i18n/locales/ru/explore.json`)
const hotel = process.argv[2] ?? "n10058556917"
const directory = `${root}/work/map-neon/evidence`
fs.mkdirSync(directory, { recursive: true })
;(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH ?? "/home/ikhail_horokhorin/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome", args: ["--no-sandbox"] })
  const checks = []
  try {
    for (const width of [1440, 375]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce", locale: "ru-RU" })
      await context.addInitScript(() => localStorage.setItem("app-locale", "ru"))
      const page = await context.newPage()
      const errors = []
      const writes = []
      page.on("pageerror", error => errors.push(error.message))
      page.on("request", request => { if (request.method() === "POST") writes.push(request.url()) })
      await page.goto(`http://127.0.0.1:18082/hotelier/${hotel}`, { waitUntil: "domcontentloaded" })
      const queue = page.getByRole("complementary", { name: copy.hotelier.queue, exact: true })
      await queue.getByText(copy.hotelier.state.open, { exact: true }).first().waitFor({ state: "visible", timeout: 30000 })
      const open = await queue.getByText(copy.hotelier.state.open, { exact: true }).count()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
      await page.screenshot({ path: `${directory}/hotelier-${width}.png`, fullPage: true, animations: "disabled" })
      checks.push({ width, open, overflow, errors, writes })
      assert.equal(overflow, false)
      assert.equal(errors.length, 0)
      assert.equal(writes.length, 0)
      assert.ok(open >= 3)
      await context.close()
    }
  } finally {
    await browser.close()
  }
  fs.writeFileSync(`${directory}/hotelier-browser.json`, JSON.stringify(checks, null, 2))
  console.log(JSON.stringify(checks))
})().catch(error => { console.error(error); process.exit(1) })

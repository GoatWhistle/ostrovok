const fs = require("node:fs")
const assert = require("node:assert/strict")
const { chromium } = require("/home/ikhail_horokhorin/projects/o-hack/frontend/node_modules/playwright")
const root = "/tmp/o-hack-sochi"
const copy = require(`${root}/frontend/src/shared/i18n/locales/ru/explore.json`)
const previous = { conversation_id: "76c2fc9d-b636-4155-83f7-6d4b479eb8d1", query: "В Сочи отель до моря пешком и рядом с барами" }
const directory = `${root}/work/map-polish/evidence/clusters`
fs.mkdirSync(directory, { recursive: true })
;(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: "/home/ikhail_horokhorin/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome", args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] })
  const checks = []
  try {
    for (const variant of [1440, 375].flatMap(width => ["ru", "en"].flatMap(locale => ["light", "dark"].map(theme => ({ width, locale, theme }))))) {
      const { width, locale, theme } = variant
      const copy = require(`${root}/frontend/src/shared/i18n/locales/${locale}/explore.json`)
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce", locale: locale === "ru" ? "ru-RU" : "en-US" })
      const response = await context.request.get(`http://127.0.0.1:18084/api/v1/chat/conversations/${previous.conversation_id}`)
      assert.equal(response.status(), 200)
      const conversation = await response.json()
      const title = conversation.title || previous.query
      const history = [{ id: conversation.id, title, updatedAt: conversation.updated_at }]
      await context.addInitScript(({ history, locale, theme }) => {
        localStorage.setItem("app-locale", locale)
        localStorage.setItem("app-theme", theme)
        localStorage.setItem("hotel-agent-conversations", JSON.stringify(history))
        localStorage.removeItem("hotel-agent-conversation")
      }, { history, locale, theme })
      const page = await context.newPage()
      page.setDefaultTimeout(30000)
      const errors = []
      let posts = 0
      page.on("pageerror", error => errors.push(error.message))
      page.on("request", request => { if (request.url().endsWith("/chat/messages") && request.method() === "POST") posts += 1 })
      await page.goto("http://127.0.0.1:18084/", { waitUntil: "domcontentloaded" })
      await page.getByRole("heading", { name: copy.chat.startTitle, exact: true }).waitFor({ state: "visible" })
      await page.getByRole("textbox", { name: copy.chat.composer }).waitFor({ state: "visible" })
      await page.getByRole("region", { name: copy.chat.recent, exact: true }).waitFor({ state: "visible" })
      const landingOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
      assert.equal(landingOverflow, false)
      await page.screenshot({ path: `${directory}/landing-${width}-${locale}-${theme}.png`, fullPage: true, animations: "disabled" })
      await page.getByRole("button", { name: copy.chat.allHistory, exact: true }).click()
      const filter = page.getByRole("searchbox", { name: copy.chat.searchHistory, exact: true })
      await filter.waitFor({ state: "visible" })
      await filter.fill(title)
      await page.getByRole("button").filter({ hasText: title }).first().click()
      await page.getByText(conversation.messages.find(item => item.role === "user").content, { exact: true }).waitFor({ state: "visible" })
      const hotel = conversation.search.results.find(item => item.hotel.id === "w51003626") ?? conversation.search.results[0]
      const sections = page.getByRole("group", { name: copy.panel.tabs })
      if (width === 375) await sections.getByRole("radio", { name: copy.panel.hotels, exact: true }).check()
      await page.getByRole("button", { name: hotel.hotel.name, exact: true }).first().click()
      await page.getByRole("article", { name: hotel.hotel.name, exact: true }).waitFor({ state: "visible" })
      if (width === 375) await sections.getByRole("radio", { name: copy.panel.map, exact: true }).check()
      await page.locator("canvas.maplibregl-canvas:visible").waitFor({ state: "visible" })
      await page.waitForFunction(() => document.fonts.status === "loaded")
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      const mapRegion = page.getByRole("region", { name: copy.map.title, exact: true })
      for (let step = 0; step < 6; step++) await mapRegion.getByRole("button", { name: copy.map.zoomOut, exact: true }).press("Enter")
      const clusters = page.locator('button[data-kind="cluster"]:visible')
      await clusters.first().waitFor({ state: "visible" })
      const background = await clusters.first().evaluate(element => ({ actual: getComputedStyle(element).backgroundColor, target: getComputedStyle(document.documentElement).getPropertyValue("--map-hotel-selected").trim() }))
      assert.notEqual(background.actual, "rgb(18, 20, 15)")
      await page.screenshot({ path: `${directory}/cluster-${width}-${locale}-${theme}.png`, fullPage: true, animations: "disabled" })
      await clusters.first().click()
      for (let step = 0; step < 6; step++) await mapRegion.getByRole("button", { name: copy.map.zoomIn, exact: true }).press("Enter")
      await page.waitForFunction(() => document.querySelectorAll('button[data-kind="cluster"]').length === 0)
      const workspaceOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
      await page.screenshot({ path: `${directory}/workspace-${width}-${locale}-${theme}.png`, fullPage: true, animations: "disabled" })
      if (workspaceOverflow) {
        const dimensions = await page.evaluate(() => ({ innerWidth, rootWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth, outside: Array.from(document.querySelectorAll("body *")).map(element => ({ tag: element.tagName, class: element.className, x: element.getBoundingClientRect().x, right: element.getBoundingClientRect().right, width: element.getBoundingClientRect().width })).filter(item => item.right > innerWidth + 1 || item.x < -1).slice(0, 20) }))
        console.log(JSON.stringify({ width, dimensions }))
        fs.writeFileSync(`${directory}/overflow-${width}.json`, JSON.stringify(dimensions, null, 2))
      }
      assert.equal(workspaceOverflow, false)
      assert.deepEqual(errors, [])
      assert.equal(posts, 0)
      await page.screenshot({ path: `${directory}/workspace-${width}-${locale}-${theme}.png`, fullPage: true, animations: "disabled" })
      const check = { width, locale, theme, landing_heading: copy.chat.startTitle, recent_history_visible: true, history_filter_and_restore: true, selected_hotel: hotel.hotel.name, landingOverflow, workspaceOverflow, errors, paid_chat_posts: posts }
      checks.push(check)
      fs.writeFileSync(`${directory}/browser-checks.json`, JSON.stringify(checks, null, 2))
      console.log(JSON.stringify(check))
      await context.close()
    }
  } finally {
    await browser.close()
  }
})().catch(error => { console.error(error); process.exitCode = 1 })

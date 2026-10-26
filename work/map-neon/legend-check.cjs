const fs = require("node:fs")
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "/home/ikhail_horokhorin/projects/o-hack/frontend/node_modules/playwright")
const root = "/home/ikhail_horokhorin/projects/o-hack-sochi"
const base = process.env.STAND_URL ?? "http://127.0.0.1:18082"
const conversationId = process.env.CONVERSATION_ID
const hotel = process.env.HOTEL_NAME
const directory = `${root}/work/map-neon/${process.argv[2] ?? "legend"}`
fs.mkdirSync(directory, { recursive: true })

;(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH ?? `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`,
    args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  })
  const report = []
  for (const locale of ["ru", "en"])
    for (const width of [1440, 375]) {
      const copy = require(`${root}/frontend/src/shared/i18n/locales/${locale}/explore.json`)
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce", locale })
      await context.addInitScript(
        ([id, lang]) => {
          localStorage.setItem("app-locale", lang)
          localStorage.setItem("app-theme", "dark")
          localStorage.setItem("hotel-agent-conversations", JSON.stringify([{ id, title: "" }]))
          localStorage.setItem("hotel-agent-conversation", id)
        },
        [conversationId, locale],
      )
      const page = await context.newPage()
      const errors = []
      page.on("pageerror", (error) => errors.push(error.message))
      await page.goto(`${base}/`, { waitUntil: "domcontentloaded" })
      const sections = page.getByRole("group", { name: copy.panel.tabs })
      if (width === 375) await sections.getByRole("radio", { name: copy.panel.hotels, exact: true }).check()
      await page.getByRole("button", { name: hotel, exact: true }).first().click()
      if (width === 375) await sections.getByRole("radio", { name: copy.panel.map, exact: true }).check()
      await page.waitForTimeout(4000)
      const toggle = page.locator("button[aria-controls]").filter({ has: page.locator("svg") })
      const legendButton = page.getByRole("button", { name: new RegExp(copy.map.layers) }).first()
      if (await legendButton.count()) await legendButton.click()
      else await toggle.last().click()
      const note = page.getByText(copy.map.legendNight)
      const visible = await note.isVisible().catch(() => false)
      await page.screenshot({ path: `${directory}/legend-${locale}-${width}.png`, animations: "disabled" })
      report.push({ locale, width, visible, errors })
      await context.close()
    }
  await browser.close()
  fs.writeFileSync(`${directory}/legend-report.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report))
})().catch((error) => {
  console.error(error)
  process.exit(1)
})

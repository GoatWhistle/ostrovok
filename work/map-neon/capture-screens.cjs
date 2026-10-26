const fs = require("node:fs")
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "/home/ikhail_horokhorin/projects/o-hack/frontend/node_modules/playwright")
const root = "/tmp/o-hack-sochi"
const copy = require(`${root}/frontend/src/shared/i18n/locales/ru/explore.json`)
const label = process.argv[2] ?? "baseline"
const base = process.env.STAND_URL ?? "http://127.0.0.1:18082"
const conversationId = process.env.CONVERSATION_ID ?? "53ad0e3e-163e-40e9-8aa3-9697fd1aed87"
const directory = `${root}/work/map-neon/${label}`
fs.mkdirSync(directory, { recursive: true })

async function settle(page) {
  await page.waitForFunction(() => document.fonts.status === "loaded")
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await page.waitForTimeout(1500)
}

async function shoot(page, name, report) {
  await settle(page)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  await page.screenshot({ path: `${directory}/${name}.png`, fullPage: false, animations: "disabled" })
  report.push({ name, overflow })
}

;(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH ?? "/home/ikhail_horokhorin/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome",
    args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  })
  const report = []
  const conversation = await (await fetch(`${base}/api/v1/chat/conversations/${conversationId}`)).json()
  const hotels = conversation.search.results.slice(0, 3).map((item) => item.hotel)
  try {
    for (const theme of ["dark", "light"]) {
      for (const width of [1440, 375]) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce", locale: "ru-RU", colorScheme: theme })
        const history = [{ id: conversation.id, title: conversation.title ?? "", updatedAt: conversation.updated_at }]
        await context.addInitScript(({ theme, history }) => {
          localStorage.setItem("app-locale", "ru")
          localStorage.setItem("app-theme", theme)
          localStorage.setItem("hotel-agent-conversations", JSON.stringify(history))
          if (location.search.includes("restore=1")) localStorage.setItem("hotel-agent-conversation", history[0].id)
          else localStorage.removeItem("hotel-agent-conversation")
        }, { theme, history })
        const page = await context.newPage()
        page.setDefaultTimeout(30000)
        const errors = []
        page.on("pageerror", (error) => errors.push(error.message))
        const suffix = `${theme}-${width}`
        await page.goto(`${base}/`, { waitUntil: "domcontentloaded" })
        await shoot(page, `home-${suffix}`, report)
        await page.goto(`${base}/?restore=1`, { waitUntil: "domcontentloaded" })
        await page.getByText(conversation.messages[0].content, { exact: true }).first().waitFor({ state: "visible" }).catch(() => {})
        const sections = page.getByRole("group", { name: copy.panel.tabs })
        const hotel = hotels[0]
        const card = page.getByRole("button", { name: hotel.name, exact: true }).first()
        if (width === 375 && (await sections.count())) await sections.getByRole("radio", { name: copy.panel.hotels, exact: true }).check().catch(() => {})
        if (await card.isVisible().catch(() => false)) {
          await card.click()
          await page.getByRole("article", { name: hotel.name, exact: true }).waitFor({ state: "visible" }).catch(() => {})
        }
        await shoot(page, `workspace-${suffix}`, report)
        if (width === 375 && (await sections.count())) {
          await sections.getByRole("radio", { name: copy.panel.map, exact: true }).check().catch(() => {})
          await shoot(page, `map-${suffix}`, report)
        }
        await page.goto(`${base}/compare?${hotels.map((item) => `hotel=${item.id}`).join("&")}`, { waitUntil: "domcontentloaded" })
        await shoot(page, `compare-${suffix}`, report)
        await page.goto(`${base}/hotelier/${hotel.id}`, { waitUntil: "domcontentloaded" })
        await shoot(page, `hotelier-${suffix}`, report)
        report.push({ suffix, errors })
        await context.close()
      }
    }
  } finally {
    await browser.close()
  }
  fs.writeFileSync(`${directory}/report.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report.filter((item) => item.overflow || item.errors?.length)))
})().catch((error) => {
  console.error(error)
  process.exit(1)
})

const fs = require("node:fs")
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "/home/ikhail_horokhorin/projects/o-hack/frontend/node_modules/playwright")
const root = "/home/ikhail_horokhorin/projects/o-hack-sochi"
const copy = require(`${root}/frontend/src/shared/i18n/locales/ru/explore.json`)
const base = process.env.STAND_URL ?? "http://127.0.0.1:18082"
const conversationId = process.env.CONVERSATION_ID ?? "53ad0e3e-163e-40e9-8aa3-9697fd1aed87"
const directory = `${root}/work/map-neon/${process.argv[2] ?? "night"}`
fs.mkdirSync(directory, { recursive: true })

async function setHour(page, hour) {
  const trigger = page.getByRole("button", { name: new RegExp(`^${copy.weather.scene}`) }).first()
  if ((await page.getByRole("button", { name: copy.weather.nextHour }).count()) === 0) await trigger.click()
  const clock = page.locator("output[aria-live='polite']").last()
  for (let step = 0; step < 24; step += 1) {
    const current = Number.parseInt((await clock.textContent()) ?? "0", 10)
    if (current === hour) return
    await page.getByRole("button", { name: current < hour ? copy.weather.nextHour : copy.weather.previousHour }).click()
  }
}

;(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH ?? `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`,
    args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  })
  const report = []
  for (const width of [1440, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce", locale: "ru-RU" })
    await context.addInitScript((id) => {
      localStorage.setItem("app-locale", "ru")
      localStorage.setItem("app-theme", "dark")
      localStorage.setItem("hotel-agent-conversations", JSON.stringify([{ id, title: "" }]))
      localStorage.setItem("hotel-agent-conversation", id)
    }, conversationId)
    const page = await context.newPage()
    const errors = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto(`${base}/`, { waitUntil: "domcontentloaded" })
    const sections = page.getByRole("group", { name: copy.panel.tabs })
    if (width === 375) await sections.getByRole("radio", { name: copy.panel.hotels, exact: true }).check()
    await page.getByRole("button", { name: "Green Club", exact: true }).first().click()
    if (width === 375) await sections.getByRole("radio", { name: copy.panel.map, exact: true }).check()
    await page.waitForTimeout(6000)
    for (const hour of [13, 21]) {
      await setHour(page, hour)
      await page.keyboard.press("Escape")
      await page.waitForTimeout(Number(process.env.SETTLE_MS ?? 5000))
      await page.screenshot({ path: `${directory}/night-${hour}-${width}.png`, animations: "disabled" })
    }
    report.push({ width, errors })
    await context.close()
  }
  await browser.close()
  fs.writeFileSync(`${directory}/night-report.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report))
})().catch((error) => {
  console.error(error)
  process.exit(1)
})

const fs = require("node:fs")
const { chromium } = require("/home/ikhail_horokhorin/projects/o-hack/frontend/node_modules/playwright")
const root = "/home/ikhail_horokhorin/projects/o-hack-sochi"
const copy = require(`${root}/frontend/src/shared/i18n/locales/ru/explore.json`)
const base = process.env.STAND_URL ?? "http://127.0.0.1:18082"
const conversationId = process.env.CONVERSATION_ID ?? "53ad0e3e-163e-40e9-8aa3-9697fd1aed87"
const out = process.argv[2]
const appearances = (process.env.APPEARANCES ?? "toy-town,neon").split(",")
const hours = (process.env.HOURS ?? "13,22").split(",").map(Number)
const zooms = Number(process.env.ZOOM_STEPS ?? 0)
fs.mkdirSync(out, { recursive: true })

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
    executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`,
    args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  })
  const report = []
  for (const appearance of appearances) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce", locale: "ru-RU" })
    await context.addInitScript(([id, look]) => {
      localStorage.setItem("app-locale", "ru")
      localStorage.setItem("factmap-map-appearance", look)
      localStorage.setItem("hotel-agent-conversations", JSON.stringify([{ id, title: "" }]))
      localStorage.setItem("hotel-agent-conversation", id)
    }, [conversationId, appearance])
    const page = await context.newPage()
    const errors = []
    page.on("pageerror", (error) => errors.push(error.message))
    page.setDefaultTimeout(90000)
    await page.goto(`${base}/?chat=${process.env.CHAT ?? "0628d9fc-70af-4a56-9c83-2a23d1d4e8c1"}&hotel=${process.env.HOTEL_ID ?? "n12749552601"}&style=${appearance}${process.env.FULL ? "&map=full" : ""}`, { waitUntil: "domcontentloaded" })
    await page.waitForTimeout(Number(process.env.LOAD_MS ?? 12000))
    await page.screenshot({ path: `${out}/${appearance}-open.png`, animations: "disabled", timeout: 90000 })
    if (zooms) {
      const canvas = page.locator("canvas.maplibregl-canvas").first()
      const box = await canvas.boundingBox()
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      for (let i = 0; i < zooms; i += 1) { await page.mouse.wheel(0, Number(process.env.WHEEL ?? -300)); await page.waitForTimeout(400) }
      await page.waitForTimeout(4000)
    }
    for (const hour of hours) {
      await setHour(page, hour)
      await page.keyboard.press("Escape")
      await page.waitForTimeout(Number(process.env.SETTLE_MS ?? 6000))
      const theme = await page.evaluate(() => document.documentElement.dataset.theme)
      const file = `${out}/${appearance}-${hour}${zooms ? `-z${zooms}` : ""}.png`
      await page.screenshot({ path: file, animations: "disabled", timeout: 90000 })
      report.push({ appearance, hour, theme, file })
    }
    report.push({ appearance, errors })
    await context.close()
  }
  await browser.close()
  console.log(JSON.stringify(report, null, 1))
})().catch((error) => { console.error(error); process.exit(1) })

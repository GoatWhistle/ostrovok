const fs = require("node:fs")
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "/home/ikhail_horokhorin/projects/o-hack/frontend/node_modules/playwright")
const root = "/tmp/o-hack-sochi"
const base = process.env.STAND_URL ?? "http://127.0.0.1:18082"
const conversationId = process.env.CONVERSATION_ID ?? "53ad0e3e-163e-40e9-8aa3-9697fd1aed87"
const label = process.argv[2] ?? "n3"
const directory = `${root}/work/map-neon/${label}`
fs.mkdirSync(directory, { recursive: true })
;(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH ?? `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`,
    args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  })
  const conversation = await (await fetch(`${base}/api/v1/chat/conversations/${conversationId}`)).json()
  const hotel = conversation.search.results.find((item) => item.hotel.id === "w51003626").hotel
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce", locale: "ru-RU" })
  await context.addInitScript((id) => {
    localStorage.setItem("app-locale", "ru")
    localStorage.setItem("app-theme", "dark")
    localStorage.setItem("hotel-agent-conversations", JSON.stringify([{ id, title: "" }]))
    localStorage.setItem("hotel-agent-conversation", id)
  }, conversation.id)
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto(`${base}/`, { waitUntil: "domcontentloaded" })
  await page.getByRole("button", { name: hotel.name, exact: true }).first().click()
  await page.getByRole("article", { name: hotel.name, exact: true }).waitFor({ state: "visible" })
  await page.getByRole("button", { name: /До моря пешком/ }).first().click()
  await page.waitForTimeout(Number(process.env.SETTLE_MS ?? 4000))
  await page.screenshot({ path: `${directory}/route-dark-1440.png`, animations: "disabled" })
  const layers = await page.evaluate(() => {
    const canvas = document.querySelector("canvas.maplibregl-canvas")
    return canvas ? canvas.width : 0
  })
  console.log(JSON.stringify({ errors, canvas: layers }))
  await browser.close()
})().catch((error) => {
  console.error(error)
  process.exit(1)
})

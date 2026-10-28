import { chromium } from "@playwright/test"

const OUT = process.argv[2]
const BASE = "http://127.0.0.1:8080"

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const problems: string[] = []
page.on("console", (message) => {
  if (message.type() === "error") problems.push(`console: ${message.text().slice(0, 160)}`)
})
page.on("requestfailed", (request) =>
  problems.push(`failed: ${request.method()} ${request.url().slice(0, 110)}`),
)
page.on("response", (response) => {
  if (response.status() >= 400)
    problems.push(`http ${response.status()}: ${response.url().slice(0, 110)}`)
})
await page.goto(BASE, { waitUntil: "domcontentloaded" })
await page.waitForTimeout(8000)
const running = await page.evaluate(() =>
  document
    .getAnimations()
    .filter((a) => a.playState === "running")
    .map((a) => {
      const effect = a.effect as KeyframeEffect | null
      const target = effect?.target as Element | null
      return {
        name: (a as unknown as { animationName?: string }).animationName ?? a.constructor.name,
        iterations: effect?.getTiming().iterations ?? null,
        element: target ? `${target.tagName}.${target.className}`.slice(0, 80) : null,
      }
    })
    .slice(0, 10),
)
const canvas = await page.evaluate(() => {
  const node = document.querySelector("canvas")
  return node ? { width: node.clientWidth, height: node.clientHeight } : null
})
await page.screenshot({ path: `${OUT}/landing.png`, animations: "disabled", timeout: 15000 })
console.log(
  JSON.stringify({ running, canvas, problems: [...new Set(problems)].slice(0, 15) }, null, 1),
)
await browser.close()

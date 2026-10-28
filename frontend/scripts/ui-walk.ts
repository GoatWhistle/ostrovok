import { chromium, type Page } from "@playwright/test"

const OUT = process.argv[2]
const BASE = "http://127.0.0.1:8080"
const QUERY = process.argv[3] ?? ""

const browser = await chromium.launch()
const problems: string[] = []

async function shoot(page: Page, name: string) {
  await page.screenshot({
    path: `${OUT}/${name}.png`,
    animations: "allow",
    timeout: 90000,
    caret: "hide",
  })
}

async function walk(width: number, theme: string) {
  const page = await browser.newPage({
    viewport: { width, height: 900 },
    colorScheme: theme as "light" | "dark",
  })
  page.on("console", (m) => {
    if (m.type() === "error")
      problems.push(`[${width}/${theme}] console: ${m.text().slice(0, 150)}`)
  })
  page.on("response", (r) => {
    if (r.status() >= 400)
      problems.push(`[${width}/${theme}] http ${r.status()}: ${r.url().slice(0, 100)}`)
  })
  await page.goto(BASE, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(9000)
  await shoot(page, `${width}-${theme}-1-landing`)
  if (!QUERY) throw new Error("pass the search query as the second argument")
  const input = page.locator("textarea, input[type=text], input[type=search]").first()
  await input.fill(QUERY)
  await input.press("Enter")
  await page.waitForTimeout(6000)
  await shoot(page, `${width}-${theme}-2-progress`)
  await page.waitForTimeout(40000)
  await shoot(page, `${width}-${theme}-3-results`)
  const card = page.locator("article, [data-hotel-id], li").first()
  if (await card.count()) {
    await card
      .click({ timeout: 5000 })
      .catch(() => problems.push(`[${width}/${theme}] card did not accept a click`))
    await page.waitForTimeout(6000)
    await shoot(page, `${width}-${theme}-4-card`)
  }
  await page.close()
}

for (const [width, theme] of [
  [1440, "light"],
  [1440, "dark"],
  [375, "light"],
] as const) {
  await walk(width, theme).catch((error) =>
    problems.push(`[${width}/${theme}] failed: ${String(error).slice(0, 180)}`),
  )
}
console.log(JSON.stringify([...new Set(problems)].slice(0, 30), null, 1))
await browser.close()

const fs = require("node:fs")
const { chromium } = require("/home/ikhail_horokhorin/projects/o-hack-sochi/frontend/node_modules/playwright")

const out = __dirname
const base = "http://127.0.0.1:5179"
const api = "http://127.0.0.1:18085/api/v1"
const hotel = "h_demo_typed_check"
const question = (key) => `q_${hotel}_${key}`

async function tabs(page) {
  return page
    .getByRole("radiogroup")
    .or(page.locator("fieldset"))
    .first()
    .evaluate((group) => [...group.querySelectorAll("label")].map((label) => label.textContent))
}

async function savedView(page) {
  const saved = page.locator("[data-saved-answer]")
  await saved.waitFor()
  return {
    id: await saved.getAttribute("data-saved-answer"),
    title: await saved.locator("[role='status'], [role='alert'], p").first().textContent(),
    text: await saved.textContent(),
    edit: await saved.getByRole("button", { name: "Изменить" }).count(),
    next: await saved.getByRole("button", { name: "Следующий вопрос" }).count(),
  }
}

async function run(browser, viewport, shots) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" })
  await context.addInitScript(() => {
    localStorage.setItem("app-locale", "ru")
    localStorage.setItem("app-theme", "dark")
  })
  const page = await context.newPage()
  page.setDefaultTimeout(30000)
  const record = { errors: [], requests: [] }
  page.on("pageerror", (error) => record.errors.push(error.message))
  page.on("request", (request) => {
    if (request.method() !== "GET") record.requests.push(`${request.method()} ${new URL(request.url()).pathname}`)
  })
  await page.goto(`${base}/hotelier/${hotel}`)
  await page.getByRole("button", { name: "Сохранить ответ", exact: true }).waitFor()
  record.tabsStart = await tabs(page)
  await page.getByRole("radio", { name: "Есть", exact: true }).check()
  await page.getByRole("button", { name: "Сохранить ответ", exact: true }).click()
  record.automatic = await savedView(page)
  record.tabsAfterFirst = await tabs(page)
  if (shots) await page.screenshot({ path: `${out}/shots/h04-saved-${viewport.width}.png`, fullPage: true })
  await page.locator("[data-saved-answer]").getByRole("button", { name: "Изменить" }).click()
  record.editPanel = await page.getByRole("button", { name: "Неверно, исправить" }).count()
  await page.locator("[data-saved-answer]").getByRole("button", { name: "Следующий вопрос" }).click()
  record.afterNext = await page.locator("section[aria-labelledby] p[lang='ru']").first().textContent()
  await page.locator("li button", { hasText: "взрослых" }).first().click()
  await page.getByRole("textbox", { name: "Взрослых в номере" }).fill("4")
  await page.getByRole("button", { name: "Сохранить ответ", exact: true }).click()
  record.manual = await savedView(page)
  await page.locator("li button", { hasText: "питомц" }).first().click()
  await page.getByRole("button", { name: "Отложить", exact: true }).click()
  await page.getByText("Вопрос отложен").waitFor()
  record.tabsAfterSkip = await tabs(page)
  await page.reload()
  await page.getByRole("radio", { name: /Отложено/ }).waitFor()
  record.tabsAfterReload = await tabs(page)
  await page.getByRole("radio", { name: /Отложено/ }).check()
  record.skippedList = await page.locator("aside li button").allTextContents()
  await page.locator("aside li button", { hasText: "питомц" }).first().click()
  await page.getByRole("button", { name: "Вернуть в работу" }).click()
  await page.getByRole("button", { name: "Сохранить ответ", exact: true }).waitFor()
  record.tabsAfterReopen = await tabs(page)
  record.activeTabAfterReopen = await page.getByRole("radio", { name: /Нужно уточнить/ }).isChecked()
  record.tabWidths = await page
    .locator("aside fieldset label")
    .evaluateAll((labels) => labels.map((label) => Math.round(label.getBoundingClientRect().width)))
  record.overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  if (shots) await page.screenshot({ path: `${out}/shots/h04-reopened-${viewport.width}.png`, fullPage: true })
  await context.close()
  return record
}

async function statuses() {
  const body = await (await fetch(`${api}/hotelier/${hotel}/questions`)).json()
  return Object.fromEntries(body.items.map((item) => [item.id, item.status]))
}

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const result = {}
  try {
    result.desktop = await run(browser, { width: 1440, height: 1000 }, true)
    result.server = await statuses()
  } finally {
    fs.writeFileSync(`${out}/h04-outcomes.json`, `${JSON.stringify(result, null, 2)}\n`)
    await browser.close()
  }
  const d = result.desktop
  const failures = [
    JSON.stringify(d.tabsStart) !== JSON.stringify(["Нужно уточнить: 3", "Отложено: 0", "Готово: 0"]) &&
      "initial counters",
    d.automatic.id !== question("double_room") && "automatic choice lost after saving",
    d.manual.id !== question("room_capacity") && "manual choice lost after saving",
    !/Ответ сохранён \d/.test(d.automatic.title) && "saved time missing",
    d.automatic.edit !== 1 || d.manual.edit !== 1 ? "edit action missing" : false,
    d.automatic.next !== 1 && "next action missing",
    d.editPanel !== 1 && "edit did not open the linked fact",
    !d.afterNext.includes("питомц") && "next did not move to the following open question",
    JSON.stringify(d.tabsAfterReload) !== JSON.stringify(d.tabsAfterSkip) && "deferral lost on reload",
    !d.tabsAfterSkip.includes("Отложено: 1") && "deferral not counted",
    !d.skippedList.some((text) => text.includes("питомц")) && "deferred question not listed",
    !d.tabsAfterReopen.includes("Нужно уточнить: 1") && "reopen not counted",
    result.server[question("pets_policy")] !== "open" && "server status not reopened",
    !d.activeTabAfterReopen && "tab did not follow the reopened question",
    new Set(d.tabWidths).size > 2 && "tabs are not equal columns",
    result.server[question("double_room")] !== "answered" && "answer not stored",
    d.requests.filter((item) => item.startsWith("PATCH")).length !== 2 && "unexpected status writes",
    d.overflow && "overflow",
    d.errors.length && "page errors",
  ].filter(Boolean)
  console.log(JSON.stringify({ failures, tabs: d.tabsAfterReopen }, null, 2))
  if (failures.length) process.exit(1)
})().catch((error) => {
  console.error(error)
  process.exit(1)
})

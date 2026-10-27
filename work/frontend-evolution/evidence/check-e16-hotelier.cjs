const fs = require("node:fs")
const { chromium } = require("/home/ikhail_horokhorin/projects/o-hack-sochi/frontend/node_modules/playwright")

const out = __dirname
const base = "http://127.0.0.1:5179"
const hotel = "h_demo_typed_check"
const question = (key) => `q_${hotel}_${key}`

async function tabs(page) {
  return page
    .locator("aside fieldset")
    .first()
    .evaluate((group) => [...group.querySelectorAll("label")].map((label) => label.textContent))
}

async function pick(page, topic) {
  await page.locator("aside li button", { hasText: topic }).first().click()
  await page.getByRole("button", { name: "Сохранить ответ", exact: true }).waitFor()
}

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const record = { errors: [], writes: [], steps: [] }
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" })
    await context.addInitScript(() => {
      localStorage.setItem("app-locale", "ru")
      localStorage.setItem("app-theme", "light")
    })
    const page = await context.newPage()
    page.setDefaultTimeout(20000)
    page.on("pageerror", (error) => record.errors.push(error.message))
    page.on("request", (request) => {
      if (request.method() !== "GET") record.writes.push(`${request.method()} ${new URL(request.url()).pathname}`)
    })
    const note = page.getByRole("textbox", { name: "Пояснение и условия", exact: true })
    await page.goto(`${base}/hotelier/${hotel}`)
    await page.getByRole("button", { name: "Сохранить ответ", exact: true }).waitFor()
    record.tabsStart = await tabs(page)
    await pick(page, "Двухместный номер")
    await page.getByRole("radio", { name: "Есть", exact: true }).check()
    await note.fill("Draft for double room")
    await pick(page, "Размещение с животными")
    record.otherQuestionNote = await note.inputValue()
    await note.fill("Draft for pets")
    await pick(page, "Двухместный номер")
    record.returned = {
      present: await page.getByRole("radio", { name: "Есть", exact: true }).isChecked(),
      note: await note.inputValue(),
    }
    record.steps.push("input, other question, return")
    let failures = 0
    await page.route("**/api/v1/hotelier/questions/*/answer", async (route) => {
      failures += 1
      await route.fulfill({ status: 503, json: { detail: "unavailable" } })
    })
    await page.getByRole("button", { name: "Сохранить ответ", exact: true }).click()
    await page.getByText("Не удалось сохранить ответ").waitFor()
    record.failed = {
      calls: failures,
      present: await page.getByRole("radio", { name: "Есть", exact: true }).isChecked(),
      note: await note.inputValue(),
    }
    await page.unroute("**/api/v1/hotelier/questions/*/answer")
    record.steps.push("error keeps draft")
    await page.getByRole("button", { name: "Сохранить ответ", exact: true }).click()
    const saved = page.locator("[data-saved-answer]")
    await saved.waitFor()
    record.saved = {
      id: await saved.getAttribute("data-saved-answer"),
      text: await saved.textContent(),
    }
    record.tabsAfterSave = await tabs(page)
    record.steps.push("retry saves")
    await saved.getByRole("button", { name: "Изменить", exact: true }).click()
    const facts = page.getByRole("complementary", { name: "Сведения об отеле", exact: true })
    const edit = facts.getByRole("button", { name: "Изменить", exact: true })
    await edit.waitFor()
    record.editLinked = await edit.count()
    record.steps.push("change opens linked fact")
    await page.reload()
    await page.locator("aside fieldset").first().waitFor()
    await page.getByRole("radio", { name: /Готово/ }).waitFor()
    record.tabsAfterReload = await tabs(page)
    await page.getByRole("radio", { name: /Готово/ }).check()
    await page.locator("aside li button", { hasText: "Двухместный номер" }).first().click()
    await saved.waitFor()
    record.savedAfterReload = await saved.getAttribute("data-saved-answer")
    await page.getByRole("radio", { name: /Нужно уточнить/ }).check()
    await pick(page, "Размещение с животными")
    record.otherDraftAfterReload = await note.inputValue()
    record.steps.push("reload keeps answer and other draft")
    record.overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
    await page.screenshot({ path: `${out}/e16-hotelier-1440.png`, fullPage: true })
    await context.close()
  } finally {
    fs.writeFileSync(`${out}/e16-hotelier.json`, `${JSON.stringify(record, null, 2)}\n`)
    await browser.close()
  }
  const answers = record.writes.filter((item) => item.endsWith("/answer"))
  const failures = [
    record.otherQuestionNote !== "" && "draft leaked into another question",
    !record.returned.present && "choice lost after returning",
    record.returned.note !== "Draft for double room" && "note lost after returning",
    record.failed.calls !== 1 && "error was not requested once",
    (!record.failed.present || record.failed.note !== "Draft for double room") && "error dropped draft",
    record.saved.id !== question("double_room") && "saved answer not shown for the question",
    !record.tabsAfterSave.includes("Готово: 1") && "saved answer not counted",
    record.editLinked !== 1 && "change did not open linked fact",
    JSON.stringify(record.tabsAfterReload) !== JSON.stringify(record.tabsAfterSave) && "counters changed on reload",
    record.savedAfterReload !== question("double_room") && "saved answer lost on reload",
    record.otherDraftAfterReload !== "Draft for pets" && "other draft lost on reload",
    answers.length !== 2 && "unexpected answer writes",
    record.writes.some((item) => item.startsWith("PATCH")) && "unexpected status writes",
    record.overflow && "overflow",
    record.errors.length && "page errors",
  ].filter(Boolean)
  console.log(JSON.stringify({ failures, writes: record.writes, tabs: record.tabsAfterReload }, null, 2))
  if (failures.length) process.exit(1)
})().catch((error) => {
  console.error(error)
  process.exit(1)
})

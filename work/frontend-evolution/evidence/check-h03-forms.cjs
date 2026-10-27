const fs = require("node:fs")
const { chromium } = require("/home/ikhail_horokhorin/projects/o-hack-sochi/frontend/node_modules/playwright")

const out = __dirname
const base = "http://127.0.0.1:5179"
const api = "http://127.0.0.1:18085/api/v1"
const hotel = "h_demo_typed_check"

async function session(browser, viewport, locale, theme) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" })
  await context.addInitScript(
    ({ locale, theme }) => {
      localStorage.setItem("app-locale", locale)
      localStorage.setItem("app-theme", theme)
    },
    { locale, theme },
  )
  const page = await context.newPage()
  page.setDefaultTimeout(30000)
  const record = { errors: [], posts: [] }
  page.on("pageerror", (error) => record.errors.push(error.message))
  page.on("request", (request) => {
    if (request.method() === "POST")
      record.posts.push({ path: new URL(request.url()).pathname, body: request.postDataJSON() })
  })
  return { context, page, record }
}

async function answer(page, record, topic, fill) {
  await page.locator("li button", { hasText: topic }).first().click()
  const before = record.posts.length
  await fill()
  const choicePosts = record.posts.length - before
  const preview = await page.getByText("Будет отправлено").locator("xpath=following-sibling::p").textContent()
  const response = page.waitForResponse((item) => item.url().includes("/answer"))
  await page.getByRole("button", { name: "Сохранить ответ", exact: true }).click()
  const body = await (await response).json()
  await page.getByText("Ответ сохранён").waitFor()
  return {
    choicePosts,
    preview,
    sent: record.posts.at(-1).body,
    extracted: body.extracted.map((fact) => ({ value: fact.value, label: fact.label })),
    followUp: body.follow_up ?? null,
  }
}

async function typed(browser) {
  const { context, page, record } = await session(browser, { width: 1440, height: 1000 }, "ru", "dark")
  const result = { record }
  await page.goto(`${base}/hotelier/${hotel}`)
  await page.locator("li button", { hasText: "питомц" }).first().waitFor()
  result.pets = await answer(page, record, "питомц", async () => {
    result.petsFieldsBefore = await page.getByRole("textbox", { name: /кг/ }).count()
    await page.getByRole("radio", { name: "Можно", exact: true }).check()
    await page.getByRole("textbox", { name: /кг/ }).fill("10")
    await page.getByRole("textbox", { name: /₽/ }).fill("500")
    await page.getByRole("textbox", { name: "Пояснение и условия" }).fill("Только собаки")
    await page.screenshot({ path: `${out}/shots/h03-pets-form-1440.png` })
  })
  result.petsResultText = await page.locator("section", { hasText: "Ответ сохранён" }).last().textContent()
  await page.locator("li button", { hasText: "взрослых" }).first().click()
  const capacity = page.getByRole("textbox", { name: "Взрослых в номере" })
  const posts = record.posts.length
  await capacity.fill("1,2.3")
  await page.getByRole("button", { name: "Сохранить ответ", exact: true }).click()
  result.invalid = {
    posts: record.posts.length - posts,
    ariaInvalid: await capacity.getAttribute("aria-invalid"),
    focused: await capacity.evaluate((element) => element === document.activeElement),
    alert: await page.getByRole("alert").first().textContent(),
  }
  result.capacity = await answer(page, record, "взрослых", async () => capacity.fill("4"))
  result.room = await answer(page, record, "двух гостей", async () => {
    await page.getByRole("radio", { name: "Есть", exact: true }).check()
  })
  const card = page.getByRole("complementary", { name: "Карточка отеля" })
  await card.getByRole("button", { name: /Высота здания/ }).click()
  await page.getByRole("button", { name: "Неверно, исправить" }).click()
  await page.getByRole("textbox", { name: "Уточнение к значению" }).fill("15")
  const corrected = page.waitForResponse((item) => item.url().includes("/correct"))
  await page.getByRole("button", { name: "Сохранить уточнение" }).click()
  result.height = { sent: (await corrected).request().postDataJSON() }
  await page.reload()
  await card.getByRole("button", { name: /С животными/ }).first().click()
  await page.getByRole("button", { name: "Неверно, исправить" }).click()
  result.petsCorrectionStart = {
    allowed: await page.getByRole("radio", { name: "Можно", exact: true }).isChecked(),
    weight: await page.getByRole("textbox", { name: /кг/ }).inputValue(),
  }
  await page.getByRole("radio", { name: "Нельзя", exact: true }).check()
  const pets = page.waitForResponse((item) => item.url().includes("/correct"))
  await page.getByRole("button", { name: "Сохранить уточнение" }).click()
  result.petsCorrection = { sent: (await pets).request().postDataJSON() }
  await page.reload()
  await card.getByText(/Высота здания/).first().waitFor()
  result.cardText = await card.textContent()
  await page.screenshot({ path: `${out}/shots/h03-after-1440.png`, fullPage: true })
  await context.close()
  return result
}

async function english(browser) {
  const { context, page, record } = await session(browser, { width: 375, height: 812 }, "en", "light")
  await page.goto(`${base}/hotelier/h_demo_hotelier`)
  await page.locator("li button", { hasText: "взрослых" }).first().click()
  const field = page.getByRole("textbox", { name: "Adults per room", exact: true })
  await field.waitFor()
  const layout = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth,
    preview: [...document.querySelectorAll("p")].some((item) => item.textContent === "Will be sent"),
  }))
  await page.screenshot({ path: `${out}/shots/h03-capacity-375-en.png`, fullPage: true })
  await context.close()
  return { record, label: await Promise.resolve("Adults per room"), layout }
}

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const result = {}
  try {
    result.typed = await typed(browser)
    result.english = await english(browser)
    const questions = await (await fetch(`${api}/hotelier/${hotel}/questions`)).json()
    result.questions = questions.items.map((item) => ({
      id: item.id,
      status: item.status,
      answer_text: item.answer_text,
      facts: item.answer_fact_ids.length,
    }))
    const card = await (await fetch(`${api}/hotels/${hotel}`)).json()
    result.facts = card.facts
      .filter((fact) => fact.status !== "superseded")
      .map((fact) => ({ key: fact.characteristic_key, value: fact.value, status: fact.status }))
  } finally {
    fs.writeFileSync(`${out}/h03-forms.json`, `${JSON.stringify(result, null, 2)}\n`)
    await browser.close()
  }
  const t = result.typed
  const failures = [
    t.petsFieldsBefore !== 0 && "pet conditions shown before permission",
    [t.pets, t.capacity, t.room].some((item) => item.choicePosts !== 0) && "a choice sent a request",
    t.pets.sent.text !== "Можно с питомцами. Вес до 10 кг. Доплата 500 ₽. Только собаки" &&
      "pet answer text differs",
    JSON.stringify(t.pets.extracted[0]?.value) !==
      JSON.stringify({ allowed: true, max_weight_kg: 10, fee_rub: 500 }) && "pet answer not parsed",
    /\{|pets_policy/.test(t.petsResultText) && "raw pet object shown",
    t.invalid.posts !== 0 && "malformed number was sent",
    t.invalid.ariaInvalid !== "true" && "malformed number not marked",
    t.capacity.extracted[0]?.value !== 4 && "capacity not parsed",
    t.room.extracted[0]?.value !== true && "room answer not parsed",
    t.height.sent.value !== 15 && "height correction not typed",
    JSON.stringify(t.petsCorrection.sent.value) !== JSON.stringify({ allowed: false }) &&
      "pet correction not typed",
    !t.petsCorrectionStart.allowed && "pet correction did not start from stored value",
    result.questions.some((item) => item.status !== "answered" || !item.facts) &&
      "questions not saved with facts",
    !result.facts.some((fact) => fact.key === "building_height" && fact.value === 15) &&
      "height not stored",
    result.english.layout.overflow && "mobile overflow",
    !result.english.layout.preview && "english preview missing",
    result.english.record.posts.length !== 0 && "english check sent a request",
    t.record.errors.length + result.english.record.errors.length !== 0 && "page errors",
  ].filter(Boolean)
  console.log(JSON.stringify({ failures, card: t.cardText }, null, 2))
  if (failures.length) process.exit(1)
})().catch((error) => {
  console.error(error)
  process.exit(1)
})

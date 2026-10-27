const fs = require("node:fs")
const { chromium } = require("/home/ikhail_horokhorin/projects/o-hack-sochi/frontend/node_modules/playwright")

const out = __dirname
const base = process.env.E16_BASE ?? "http://127.0.0.1:5181"
const chat = JSON.parse(fs.readFileSync(`${out}/e12-conversation.json`)).id
const hotel = "n11331531334"
const gpu = {
  headless: false,
  args: ["--enable-webgl", "--ignore-gpu-blocklist", "--window-size=1440,960"],
  env: { ...process.env, GALLIUM_DRIVER: "d3d12" },
}
const noWebgl = { headless: true, args: ["--disable-webgl", "--disable-3d-apis"] }

async function session(browser, { width = 1440, height = 900, motion = "no-preference", slow = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: motion })
  await context.addInitScript(() => {
    localStorage.setItem("app-locale", "ru")
    localStorage.setItem("app-theme", "dark")
  })
  const page = await context.newPage()
  page.setDefaultTimeout(60000)
  const record = { errors: [], posts: [], steps: [] }
  page.on("pageerror", (error) => record.errors.push(error.message))
  page.on("request", (request) => {
    if (request.method() !== "GET") record.posts.push(`${request.method()} ${new URL(request.url()).pathname}`)
  })
  if (slow) {
    const cdp = await context.newCDPSession(page)
    await cdp.send("Network.enable")
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 300,
      downloadThroughput: (1.5 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    })
  }
  const step = async (name, action) => {
    const started = Date.now()
    await action()
    record.steps.push({ name, ms: Date.now() - started })
  }
  return { context, page, record, step }
}

const composer = (page) => page.getByRole("textbox", { name: "Сообщение для подбора" })
const send = (page) => page.getByRole("button", { name: "Отправить", exact: true })

async function conversationJourney(browser, options) {
  const { context, page, record, step } = await session(browser, options)
  const webgl = !options.noWebgl
  const shot = async (name) => {
    if (options.shots) await page.screenshot({ path: `${out}/shots/e16-${name}.png` })
  }
  await step("cover", async () => {
    await page.goto(`${base}/`)
    if (webgl) await page.locator(".maplibregl-canvas").first().waitFor()
    record.coverCanvas = await page.locator(".maplibregl-canvas").count()
  })
  await step("clarification stays in full chat", async () => {
    await composer(page).fill("Хочу отель рядом с морем")
    await send(page).click()
    await page.getByText(/Уточните условия поиска/).waitFor()
    record.afterClarification = {
      results: await page.locator("[id^='hotel-result-']").count(),
      draftKept: true,
      maps: await page.locator("[data-map-active]").count(),
    }
  })
  await step("results reveal three columns", async () => {
    await composer(page).fill("Хочу отель в Сочи рядом с морем")
    await send(page).click()
    await page.locator(`#hotel-result-${hotel}`).waitFor()
    record.reveal = await page.evaluate(() => ({
      list: Boolean(document.querySelector("[id^='hotel-result-']")),
      map: Boolean(document.querySelector("[data-map-active]")),
      chat: Boolean(document.querySelector("[role='log']")),
      overflow: document.documentElement.scrollWidth > innerWidth,
    }))
    await page.waitForTimeout(1500)
    await shot("reveal")
  })
  await step("panel one third and rooms", async () => {
    const aside = page.locator("aside").first()
    record.listWidth = Math.round((await aside.boundingBox()).width)
    await page.locator(`#hotel-result-${hotel}`).click()
    await page.getByRole("button", { name: "Открыть страницу отеля", exact: true }).waitFor()
    record.panelWidth = Math.round((await aside.boundingBox()).width)
    await page.waitForTimeout(800)
    await shot("panel")
    await page.getByRole("button", { name: "Номера и цены", exact: true }).first().click()
    await page.locator(`[id='${hotel}-rooms']`).waitFor()
    record.roomsFocused = await page.evaluate((id) => document.activeElement?.id === `${id}-rooms`, hotel)
    if (await page.getByRole("region", { name: "Страница отеля", exact: true }).count())
      await page.getByRole("button", { name: "Назад к просмотру", exact: true }).click()
    await page.getByRole("button", { name: "Все отели", exact: true }).click()
    await page.locator(`#hotel-result-${hotel}`).waitFor()
    await page.waitForTimeout(500)
    record.returnedWidth = Math.round((await aside.boundingBox()).width)
  })
  await step("big map, hotel page, minimap and back", async () => {
    await page.locator(`#hotel-result-${hotel}`).click()
    await page.getByRole("button", { name: "Карта на весь экран", exact: true }).click()
    await page.locator('[data-full-map="true"]').first().waitFor()
    await page.waitForTimeout(1500)
    await shot("full-map")
    await page.locator("[data-map-hotel]").getByRole("button", { name: "Открыть страницу отеля", exact: true }).click()
    await page.getByRole("region", { name: "Страница отеля", exact: true }).waitFor()
    await page.locator("[data-hotel-location]").scrollIntoViewIfNeeded()
    if (webgl) await page.locator('[data-minimap-active="true"]').waitFor()
    record.minimap = await page.locator("[data-minimap-active]").count()
    await page.waitForTimeout(1000)
    await shot("hotel-page")
    await page.getByRole("button", { name: "Назад к просмотру", exact: true }).click()
    await page.locator("[data-map-hotel]").waitFor()
    await page.getByRole("button", { name: "Вернуться к поиску", exact: true }).click()
    await page.locator("aside").first().getByRole("button", { name: "Открыть страницу отеля", exact: true }).waitFor()
    record.exitRestoresPanel = true
    await page.waitForTimeout(1000)
    await shot("exit")
  })
  await step("browser back and forward", async () => {
    await page.evaluate(() => history.back())
    await page.waitForTimeout(1200)
    record.back = new URL(page.url()).pathname + new URL(page.url()).search.replace(/chat=[^&]+&?/, "")
    await page.evaluate(() => history.forward())
    await page.waitForTimeout(1200)
    record.forward = new URL(page.url()).pathname + new URL(page.url()).search.replace(/chat=[^&]+&?/, "")
  })
  record.canvases = await page.locator(".maplibregl-canvas").count()
  await context.close()
  return record
}

async function mobileJourney(browser) {
  const { context, page, record, step } = await session(browser, { width: 375, height: 812 })
  await step("full chat then results", async () => {
    await page.goto(`${base}/`)
    await composer(page).fill("Хочу отель рядом с морем")
    await send(page).click()
    await page.getByText(/Уточните условия поиска/).waitFor()
    record.tabsBeforeResults = await page.getByRole("radio", { name: "Отели", exact: true }).count()
    await composer(page).fill("Хочу отель в Сочи рядом с морем")
    await send(page).click()
    await page.getByRole("radio", { name: "Отели", exact: true }).click()
    await page.locator(`#hotel-result-${hotel}`).waitFor()
  })
  await step("details full width and page with minimap", async () => {
    await page.locator(`#hotel-result-${hotel}`).click()
    const open = page.getByRole("button", { name: "Открыть страницу отеля", exact: true })
    await open.waitFor()
    record.detailsWidth = Math.round((await page.locator("aside").first().boundingBox()).width)
    await open.click()
    await page.getByRole("region", { name: "Страница отеля", exact: true }).waitFor()
    await page.locator("[data-hotel-location]").scrollIntoViewIfNeeded()
    await page.locator('[data-minimap-active="true"]').waitFor()
    record.minimap = await page.locator("[data-minimap-active]").count()
    await page.getByRole("button", { name: "Назад к просмотру", exact: true }).click()
    await page.getByRole("button", { name: "Все отели", exact: true }).click()
    await page.locator(`#hotel-result-${hotel}`).waitFor()
  })
  await step("map tab and full map card", async () => {
    await page.locator(`#hotel-result-${hotel}`).click()
    await page.getByRole("radio", { name: "Карта", exact: true }).click()
    await page.getByRole("button", { name: "Карта на весь экран", exact: true }).click()
    await page.locator("[data-map-hotel]").waitFor()
    const card = await page.locator("[data-map-hotel]").boundingBox()
    record.cardBottom = Math.round(card.y + card.height)
    await page.getByRole("button", { name: "Вернуться к поиску", exact: true }).click()
    await page.getByRole("radio", { name: "Чат", exact: true }).click()
    record.composerVisible = await composer(page).isVisible()
  })
  record.overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  await context.close()
  return record
}

async function designsJourney(browser) {
  const { context, page, record, step } = await session(browser, { motion: "reduce" })
  await page.goto(`${base}/?chat=${chat}&tab=hotels`)
  await page.locator('[data-map-active="true"]').waitFor()
  const before = record.posts.length
  record.designs = []
  for (const design of ["Игрушечный город", "Ночной город"]) {
    await step(`design ${design}`, async () => {
      await page.getByRole("button", { name: "Оформление карты" }).click()
      await page.locator("label", { hasText: design }).click()
      await page.keyboard.press("Escape")
      await page.locator(`#hotel-result-${hotel}`).click()
      await page.locator("aside").first().getByRole("button", { name: "Показать на карте", exact: true }).first().click()
      await page.waitForTimeout(800)
      const routes = await page.evaluate(() => {
        const element = document.querySelector(".maplibregl-map")
        let fiber = element?.[Object.keys(element).find((key) => key.startsWith("__reactFiber"))]
        while (fiber) {
          let hook = fiber.memoizedState
          for (let index = 0; hook && index < 100; index++, hook = hook.next) {
            const value = hook.memoizedState
            if (value?.current?.getSource) {
              const data = value.current.getSource("routes")?._data
              return (data?.geojson ?? data)?.features?.length ?? 0
            }
          }
          fiber = fiber.return
        }
        return -1
      })
      const weather = await page.locator("[aria-label*='Солнце и погода']").count()
      await page.locator("[aria-label*='Солнце и погода']").first().click()
      const hour = page.locator("output").filter({ hasText: /:/ }).first()
      const before = await hour.textContent()
      await page.getByRole("button", { name: "На час позже", exact: true }).click()
      const after = await hour.textContent()
      await page.keyboard.press("Escape")
      const sun = before !== after ? 1 : 0
      const panel = page.locator("aside").first()
      await panel.getByRole("button", { name: "В сравнение", exact: true }).click()
      const remove = panel.getByRole("button", { name: "Убрать из сравнения", exact: true })
      await remove.waitFor()
      const compare = await remove.count()
      await remove.click()
      await panel.getByRole("button", { name: "В сравнение", exact: true }).waitFor()
      await page.getByRole("button", { name: "Все отели", exact: true }).click()
      record.designs.push({ design, routes, sun, weather, compare })
    })
  }
  await step("history", async () => {
    await page.getByRole("button", { name: "История", exact: true }).click()
    record.history = await page.getByLabel("История чатов", { exact: true }).getByRole("button").count()
  })
  record.searchPostsDuringDesigns = record.posts.slice(before).filter((item) => item.includes("/chat/messages")).length
  await context.close()
  return record
}

async function emptyAndDirect(browser) {
  const { context, page, record, step } = await session(browser, { motion: "reduce" })
  await page.route("**/api/v1/chat/messages", async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    await route.fulfill({ response, json: { ...body, search: body.search ? { ...body.search, results: [] } : body.search } })
  })
  await step("empty results stay honest", async () => {
    await page.goto(`${base}/`)
    await composer(page).fill("Хочу отель в Сочи рядом с морем")
    await send(page).click()
    await page.waitForTimeout(3000)
    record.empty = {
      results: await page.locator("[id^='hotel-result-']").count(),
      maps: await page.locator("[data-map-active]").count(),
      chat: await page.locator("[role='log']").count(),
    }
  })
  await page.unroute("**/api/v1/chat/messages")
  await step("direct hotel link", async () => {
    await page.goto(`${base}/hotels/${hotel}`)
    await page.getByRole("region", { name: "Страница отеля", exact: true }).waitFor()
    record.direct = { posts: record.posts.filter((item) => item.includes("/chat/messages")).length }
    await page.goto(`${base}/hotels/missing-hotel-id`)
    await page.waitForTimeout(2000)
    record.missing = await page.getByRole("button", { name: /Повторить|На главную|Назад/ }).count()
  })
  await context.close()
  return record
}

;(async () => {
  const result = {}
  const gpuBrowser = await chromium.launch(gpu)
  const plainBrowser = await chromium.launch(noWebgl)
  try {
    result.desktop = await conversationJourney(gpuBrowser, { shots: true })
    result.slowNetwork = await conversationJourney(gpuBrowser, { slow: true })
    result.mobile = await mobileJourney(gpuBrowser).catch((error) => ({
      failed: String(error).slice(0, 300),
    }))
    result.noWebgl = await conversationJourney(plainBrowser, { noWebgl: true }).catch((error) => ({
      failed: String(error).slice(0, 300),
    }))
    result.designs = await designsJourney(gpuBrowser)
    result.emptyAndDirect = await emptyAndDirect(gpuBrowser)
  } finally {
    fs.writeFileSync(`${out}/e16-journeys.json`, `${JSON.stringify(result, null, 2)}\n`)
    await gpuBrowser.close()
    await plainBrowser.close()
  }
  console.log(JSON.stringify(result, null, 1).slice(0, 6000))
})().catch((error) => {
  console.error(error)
  process.exit(1)
})

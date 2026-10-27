const fs = require("node:fs")
const { chromium } = require("/home/ikhail_horokhorin/projects/o-hack-sochi/frontend/node_modules/playwright")

const out = __dirname
const base = process.env.E15_BASE ?? "http://127.0.0.1:5181"
const chat = JSON.parse(fs.readFileSync(`${out}/e12-conversation.json`)).id
const hotel = "n11331531334"

function instrument() {
  const counts = {
    workers: 0,
    terminated: 0,
    observers: 0,
    disconnected: 0,
    listenersAdded: 0,
    listenersRemoved: 0,
    animationFrames: 0,
    glContexts: 0,
    sceneRequests: 0,
  }
  window.__counts = counts
  window.__findMap = (selector) => {
    const element = document.querySelector(selector)
    let fiber = element?.[Object.keys(element ?? {}).find((key) => key.startsWith("__reactFiber"))]
    while (fiber) {
      let hook = fiber.memoizedState
      for (let index = 0; hook && index < 100; index++, hook = hook.next) {
        const value = hook.memoizedState
        if (value?.current?.getCenter && value.current.jumpTo) return value.current
      }
      fiber = fiber.return
    }
    return null
  }
  const NativeWorker = window.Worker
  window.Worker = class extends NativeWorker {
    constructor(...args) {
      super(...args)
      counts.workers += 1
    }
    terminate() {
      counts.terminated += 1
      return super.terminate()
    }
  }
  for (const name of ["ResizeObserver", "IntersectionObserver", "MutationObserver"]) {
    const Native = window[name]
    window[name] = class extends Native {
      constructor(...args) {
        super(...args)
        counts.observers += 1
      }
      disconnect() {
        counts.disconnected += 1
        return super.disconnect()
      }
    }
  }
  const add = EventTarget.prototype.addEventListener
  const remove = EventTarget.prototype.removeEventListener
  EventTarget.prototype.addEventListener = function (...args) {
    if (this === window || this === document) counts.listenersAdded += 1
    return add.apply(this, args)
  }
  EventTarget.prototype.removeEventListener = function (...args) {
    if (this === window || this === document) counts.listenersRemoved += 1
    return remove.apply(this, args)
  }
  const frame = window.requestAnimationFrame.bind(window)
  window.requestAnimationFrame = (callback) => {
    counts.animationFrames += 1
    return frame(callback)
  }
  const context = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const created = context.call(this, type, ...rest)
    if (created && String(type).startsWith("webgl") && !this.__counted) {
      this.__counted = true
      counts.glContexts += 1
    }
    return created
  }
  const fetchNative = window.fetch.bind(window)
  window.fetch = (input, init) => {
    if (String(input?.url ?? input).includes("/map/scene")) counts.sceneRequests += 1
    return fetchNative(input, init)
  }
}

const snapshot = (page) =>
  page.evaluate(() => ({
    ...window.__counts,
    liveObservers: window.__counts.observers - window.__counts.disconnected,
    liveListeners: window.__counts.listenersAdded - window.__counts.listenersRemoved,
    liveWorkers: window.__counts.workers - window.__counts.terminated,
    canvases: document.querySelectorAll("canvas.maplibregl-canvas").length,
    maps: document.querySelectorAll(".maplibregl-map").length,
  }))

async function session(browser, motion = "reduce") {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: motion })
  await context.addInitScript(instrument)
  await context.addInitScript(() => {
    localStorage.setItem("app-locale", "ru")
    localStorage.setItem("app-theme", "dark")
  })
  const page = await context.newPage()
  page.setDefaultTimeout(60000)
  const errors = []
  page.on("pageerror", (error) => errors.push(error.message))
  return { context, page, errors }
}

async function cycles(browser) {
  const { context, page, errors } = await session(browser)
  await page.goto(`${base}/?chat=${chat}&tab=hotels`)
  await page.locator('[data-map-active="true"]').waitFor()
  const rows = [{ cycle: 0, ...(await snapshot(page)) }]
  for (let cycle = 1; cycle <= 10; cycle++) {
    await page.locator(`#hotel-result-${hotel}`).click()
    await page.getByRole("button", { name: "Открыть страницу отеля", exact: true }).click()
    await page.getByRole("region", { name: "Страница отеля", exact: true }).waitFor()
    await page.locator("[data-hotel-location]").scrollIntoViewIfNeeded()
    await page.locator('[data-minimap-active="true"]').waitFor()
    const onPage = await snapshot(page)
    await page.getByRole("button", { name: "Открыть большую карту", exact: true }).click()
    await page.locator('[data-full-map="true"]').first().waitFor()
    await page.getByRole("button", { name: "Вернуться к отелю", exact: true }).click()
    await page.getByRole("region", { name: "Страница отеля", exact: true }).waitFor()
    await page.getByRole("button", { name: "Назад к просмотру", exact: true }).click()
    await page.getByRole("button", { name: "Все отели", exact: true }).click()
    await page.locator(`#hotel-result-${hotel}`).waitFor()
    await page.getByRole("button", { name: "Оформление карты" }).click()
    const target = cycle % 2 ? "Игрушечный город" : "Ночной город"
    await page.locator("label", { hasText: target }).click()
    await page.keyboard.press("Escape")
    await page.waitForTimeout(400)
    rows.push({ cycle, onPageCanvases: onPage.canvases, ...(await snapshot(page)) })
  }
  await context.close()
  return { rows, errors }
}

async function hiddenMap(browser) {
  const { context, page, errors } = await session(browser)
  await page.goto(`${base}/?chat=${chat}&tab=hotels`)
  await page.locator('[data-map-active="true"]').waitFor()
  await page.waitForTimeout(3000)
  await page.evaluate((selector) => {
    const map = window.__findMap(selector)
    window.__main = { renders: 0 }
    map.on("render", () => {
      window.__main.renders += 1
    })
  }, ".maplibregl-map")
  await page.locator(`#hotel-result-${hotel}`).click()
  await page.getByRole("button", { name: "Открыть страницу отеля", exact: true }).click()
  await page.getByRole("region", { name: "Страница отеля", exact: true }).waitFor()
  await page.waitForTimeout(3000)
  const before = await page.evaluate(() => ({ ...window.__counts, renders: window.__main.renders }))
  await page.waitForTimeout(30000)
  const after = await page.evaluate(() => ({ ...window.__counts, renders: window.__main.renders }))
  const active = await page.locator("[data-map-active]").first().getAttribute("data-map-active")
  await context.close()
  return {
    mainActive: active,
    mainRenders: after.renders - before.renders,
    animationFrames: after.animationFrames - before.animationFrames,
    sceneRequests: after.sceneRequests - before.sceneRequests,
    errors,
  }
}

async function cover(browser) {
  const { context, page, errors } = await session(browser, "no-preference")
  await page.goto(`${base}/`)
  await page.locator(".maplibregl-canvas").first().waitFor()
  await page.waitForTimeout(4000)
  const running = await page.evaluate(() => window.__counts.animationFrames)
  await page.waitForTimeout(2000)
  const runningRate = (await page.evaluate(() => window.__counts.animationFrames)) - running
  const composer = page.getByRole("textbox", { name: "Сообщение для подбора" })
  await composer.focus()
  await page.waitForTimeout(1000)
  const paused = await page.evaluate(() => window.__counts.animationFrames)
  await page.waitForTimeout(5000)
  const pausedFrames = (await page.evaluate(() => window.__counts.animationFrames)) - paused
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" })
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true })
    document.dispatchEvent(new Event("visibilitychange"))
  })
  const hidden = await page.evaluate(() => window.__counts.animationFrames)
  await page.waitForTimeout(5000)
  const hiddenFrames = (await page.evaluate(() => window.__counts.animationFrames)) - hidden
  await page.evaluate(() => {
    delete document.visibilityState
    delete document.hidden
    document.dispatchEvent(new Event("visibilitychange"))
  })
  const transitions = [await snapshot(page)]
  for (let round = 1; round <= 3; round++) {
    await composer.fill("Хочу отель в Сочи рядом с морем")
    await page.getByRole("button", { name: "Отправить", exact: true }).click()
    await page.locator('[data-map-active="true"]').waitFor()
    await page.waitForTimeout(1000)
    const workspace = await snapshot(page)
    await page.getByRole("link", { name: /factmap/ }).first().click()
    await page.locator(".maplibregl-canvas").first().waitFor()
    await page.waitForTimeout(1500)
    transitions.push({ round, workspaceCanvases: workspace.canvases, ...(await snapshot(page)) })
  }
  await context.close()
  return { runningRate, pausedFrames, hiddenFrames, transitions, errors }
}

;(async () => {
  const browser = await chromium.launch({
    headless: false,
    args: ["--enable-webgl", "--ignore-gpu-blocklist", "--window-size=1440,960"],
    env: { ...process.env, GALLIUM_DRIVER: "d3d12" },
  })
  const result = {}
  try {
    result.cycles = await cycles(browser)
    result.hidden = await hiddenMap(browser)
    result.cover = await cover(browser)
  } finally {
    fs.writeFileSync(`${out}/e15-lifecycle.json`, `${JSON.stringify(result, null, 2)}\n`)
    await browser.close()
  }
  const first = result.cycles.rows[1]
  const last = result.cycles.rows.at(-1)
  console.log(JSON.stringify({ first, last }, null, 1))
  console.log(JSON.stringify(result.hidden))
  console.log(JSON.stringify({ ...result.cover, transitions: result.cover.transitions.map((row) => [row.round, row.workspaceCanvases, row.canvases, row.liveWorkers, row.liveObservers, row.liveListeners]) }))
})().catch((error) => {
  console.error(error)
  process.exit(1)
})

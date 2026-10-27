const { chromium } = require("/home/ikhail_horokhorin/projects/o-hack-sochi/frontend/node_modules/playwright")
const fs = require("node:fs")
const out = __dirname
const chat = JSON.parse(fs.readFileSync(`${out}/e12-conversation.json`)).id
const base = "http://127.0.0.1:5179"
const hotel = "n11331531334"
const point = [39.904065, 43.4451502]
const motion = process.env.MOTION === "normal" ? "no-preference" : "reduce"
const report = motion === "reduce" ? "e11-location.json" : "e11-location-motion.json"
const webgl = ["--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]

function inspect(selector) {
  const element = document.querySelector(selector)
  if (!element) return null
  let fiber = element[Object.keys(element).find((key) => key.startsWith("__reactFiber"))]
  let map
  while (fiber && !map) {
    let hook = fiber.memoizedState
    for (let index = 0; hook && index < 100 && !map; index++, hook = hook.next) {
      const value = hook.memoizedState
      if (value?.current?.getCenter && value.current.jumpTo) map = value.current
    }
    fiber = fiber.return
  }
  if (!map) return { found: false }
  const source = map.getSource("routes")?._data
  const routes = source?.geojson ?? source
  const extrusions = (map.getStyle().layers ?? []).filter((layer) => layer.type === "fill-extrusion")
  const marker = element.querySelector("[data-minimap-hotel]")
  const box = marker?.getBoundingClientRect()
  const frame = element.getBoundingClientRect()
  return {
    found: true,
    center: map.getCenter().toArray(),
    zoom: map.getZoom(),
    pitch: map.getPitch(),
    bearing: map.getBearing(),
    terrain: Boolean(map.getTerrain()),
    scrollZoom: map.scrollZoom.isEnabled(),
    dragPan: map.dragPan.isEnabled(),
    routes: routes?.features?.map((feature) => ({ id: feature.id, type: feature.geometry.type })) ?? [],
    visibleExtrusions: extrusions.filter(
      (layer) => map.getLayoutProperty(layer.id, "visibility") !== "none",
    ).length,
    background: map.getLayer("canvas") ? map.getPaintProperty("canvas", "background-color") : null,
    markerInside: Boolean(marker && element.querySelector(".maplibregl-canvas-container")?.contains(marker)),
    markerOffset: box && [
      Math.round(box.x + box.width / 2 - frame.x - map.project(window.__hotelPoint).x),
      Math.round(box.y + box.height / 2 - frame.y - map.project(window.__hotelPoint).y),
    ],
  }
}

async function page(browser, viewport, gl, init) {
  const context = await browser.newContext({ viewport, reducedMotion: motion })
  const tab = await context.newPage()
  tab.setDefaultTimeout(90000)
  const record = { errors: [], posts: [] }
  tab.on("pageerror", (error) => record.errors.push(error.message))
  tab.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/chat/messages")) record.posts.push(request.url())
  })
  await tab.addInitScript(
    ({ point, theme, locale }) => {
      window.__hotelPoint = point
      localStorage.setItem("app-theme", theme)
      localStorage.setItem("app-locale", locale)
      localStorage.setItem("factmap-panel-width", "352")
      localStorage.setItem("factmap-chat-width", "320")
    },
    { point, ...init },
  )
  return { tab, record, context, gl }
}

const pageScroll = (tab) =>
  tab.evaluate(() => document.querySelector("[data-hotel-location]")?.closest("[tabindex='-1']")?.scrollTop ?? null)

async function settle(tab) {
  let previous = await pageScroll(tab)
  for (let attempt = 0; attempt < 20; attempt++) {
    await tab.waitForTimeout(150)
    const next = await pageScroll(tab)
    if (next === previous) return next
    previous = next
  }
  return previous
}

const anchor = (tab) =>
  tab.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getTiming().iterations !== Number.POSITIVE_INFINITY)
        .map((animation) => animation.finished.catch(() => undefined)),
    )
    const block = document.querySelector("[data-hotel-location]")
    const area = block?.closest("[tabindex='-1']")
    return block && area ? Math.round(block.getBoundingClientRect().top - area.getBoundingClientRect().top) : null
  })

async function revealLocation(tab) {
  await tab.locator("[data-hotel-location]").scrollIntoViewIfNeeded()
  await tab.locator('[data-minimap-active="true"]').waitFor()
  await tab.waitForFunction(() => document.querySelector("[data-minimap-active] .maplibregl-canvas"))
  await tab.waitForTimeout(800)
}

async function workspaceFlow(browser) {
  const { tab, record, context } = await page(browser, { width: 1440, height: 900 }, true, { theme: "dark", locale: "ru" })
  await tab.goto(`${base}/?chat=${chat}&tab=hotels`, { waitUntil: "domcontentloaded" })
  await tab.locator(`#hotel-result-${hotel}`).scrollIntoViewIfNeeded()
  await tab.locator(".maplibregl-canvas").first().waitFor()
  await tab.evaluate(() => {
    window.__mainCanvas = document.querySelector(".maplibregl-canvas")
  })
  await tab.locator(`#hotel-result-${hotel}`).click()
  await tab.getByRole("button", { name: "Открыть страницу отеля", exact: true }).waitFor()
  await tab.waitForURL(`**hotel=${hotel}**`)
  await tab.waitForTimeout(800)
  await tab.locator("aside").first().getByRole("button", { name: "Показать на карте", exact: true }).first().click()
  await tab.waitForTimeout(400)
  record.focusedUrl = await tab.evaluate(() => location.pathname + location.search)
  await tab.getByRole("button", { name: "Открыть страницу отеля", exact: true }).click()
  await tab.getByRole("region", { name: "Страница отеля", exact: true }).waitFor()
  record.beforeReveal = await tab.evaluate(() => ({
    minimap: document.querySelectorAll("[data-minimap-active]").length,
    canvases: document.querySelectorAll(".maplibregl-canvas").length,
  }))
  await revealLocation(tab)
  record.mini = await tab.evaluate(inspect, "[data-minimap-active]")
  record.onPage = await tab.evaluate(() => ({
    canvases: document.querySelectorAll(".maplibregl-canvas").length,
    mainActive: document.querySelector("[data-map-active]")?.dataset.mapActive,
    sameMain: window.__mainCanvas === document.querySelector("[data-map-active] .maplibregl-canvas"),
    address: document.querySelector("[data-hotel-location] p")?.textContent,
  }))
  await tab.screenshot({ path: `${out}/shots/${motion === "reduce" ? "" : "motion-"}e11-location-desktop.png` })
  const frame = await tab.locator("[data-minimap-active]").boundingBox()
  const scrollBeforeWheel = await pageScroll(tab)
  await tab.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2)
  await tab.mouse.wheel(0, -240)
  await tab.waitForTimeout(400)
  await settle(tab)
  record.wheel = { before: scrollBeforeWheel, after: await pageScroll(tab), zoom: (await tab.evaluate(inspect, "[data-minimap-active]")).zoom }
  await tab.getByRole("button", { name: "Открыть большую карту", exact: true }).scrollIntoViewIfNeeded()
  await settle(tab)
  record.scrollBefore = await pageScroll(tab)
  record.anchorBefore = await anchor(tab)
  record.leaving = await tab.evaluate(() => {
    const area = document.querySelector("[data-hotel-location]").closest("[tabindex='-1']")
    const button = [...document.querySelectorAll("button")].find((item) => item.textContent === "Открыть большую карту")
    const box = button.getBoundingClientRect()
    const frame = area.getBoundingClientRect()
    const seen = []
    area.addEventListener("scroll", () => seen.push(area.scrollTop))
    window.__leaving = seen
    return { scrollTop: area.scrollTop, buttonBottom: Math.round(box.bottom), areaBottom: Math.round(frame.bottom) }
  })
  await tab.getByRole("button", { name: "Открыть большую карту", exact: true }).click()
  await tab.locator('[data-full-map="true"]').first().waitFor()
  await tab.locator('[data-map-active="true"]').waitFor()
  await tab.waitForTimeout(800)
  record.fullMap = await tab.evaluate(() => ({
    url: location.pathname + location.search,
    canvases: document.querySelectorAll(".maplibregl-canvas").length,
    sameMain: window.__mainCanvas === document.querySelector(".maplibregl-canvas"),
    card: Boolean(document.querySelector("[data-map-hotel]")),
  }))
  record.fullRoute = await tab.evaluate(inspect, "[data-map-active]")
  record.leaving.scrolls = await tab.evaluate(() => window.__leaving)
  await tab.screenshot({ path: `${out}/shots/${motion === "reduce" ? "" : "motion-"}e11-large-map-desktop.png` })
  await tab.evaluate(() => {
    window.__trace = []
    const started = performance.now()
    const frame = () => {
      const area = document.querySelector("[data-hotel-location]")?.closest("[tabindex='-1']")
      const region = document.querySelector('[aria-label="Страница отеля"]')
      const scroller = area ?? region?.querySelector("[tabindex='-1']")
      window.__trace.push([
        Math.round(performance.now() - started),
        scroller?.scrollTop ?? null,
        scroller?.scrollHeight ?? null,
        document.activeElement?.tagName + ":" + (document.activeElement?.textContent ?? "").slice(0, 24),
      ])
      if (performance.now() - started < 2500) requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  })
  await tab.getByRole("button", { name: "Вернуться к отелю", exact: true }).click()
  await tab.getByRole("region", { name: "Страница отеля", exact: true }).waitFor()
  await tab.locator('[data-minimap-active="true"]').waitFor()
  await tab.waitForTimeout(600)
  await settle(tab)
  record.returned = {
    url: await tab.evaluate(() => location.pathname + location.search),
    scroll: await pageScroll(tab),
    anchor: await anchor(tab),
    trace: await tab.evaluate(() => window.__trace.filter((row, index, all) => index === 0 || row[1] !== all[index - 1][1] || row[2] !== all[index - 1][2] || row[3] !== all[index - 1][3])),
    canvases: await tab.evaluate(() => document.querySelectorAll(".maplibregl-canvas").length),
    sameMain: await tab.evaluate(() => window.__mainCanvas === document.querySelector("[data-map-active] .maplibregl-canvas")),
    routes: (await tab.evaluate(inspect, "[data-minimap-active]")).routes,
  }
  await tab.getByRole("button", { name: "Назад к просмотру", exact: true }).click()
  await tab.getByRole("button", { name: "Открыть страницу отеля", exact: true }).waitFor()
  await tab.waitForTimeout(400)
  record.panel = await tab.evaluate(() => ({
    canvases: document.querySelectorAll(".maplibregl-canvas").length,
    minimap: document.querySelectorAll("[data-minimap-active]").length,
  }))
  await context.close()
  return record
}

async function directFlow(browser, appearance) {
  const { tab, record, context } = await page(browser, { width: 1440, height: 900 }, true, { theme: "light", locale: "en" })
  await tab.goto(`${base}/hotels/${hotel}?style=${appearance}`, { waitUntil: "domcontentloaded" })
  await tab.getByRole("region", { name: "Hotel page", exact: true }).waitFor()
  await revealLocation(tab)
  record.mini = await tab.evaluate(inspect, "[data-minimap-active]")
  record.canvases = await tab.evaluate(() => document.querySelectorAll(".maplibregl-canvas").length)
  await tab.screenshot({ path: `${out}/shots/${motion === "reduce" ? "" : "motion-"}e11-direct-${appearance}.png` })
  await tab.getByRole("button", { name: "Open large map", exact: true }).click()
  await tab.locator('[data-full-map="true"]').first().waitFor()
  await tab.locator('[data-map-active="true"]').waitFor()
  await tab.waitForTimeout(1200)
  record.large = await tab.evaluate(() => {
    const pin = document.querySelector('[data-map-active] [data-selected="true"], [data-map-active] [data-kind="place"]')
    return {
      url: location.pathname + location.search,
      canvases: document.querySelectorAll(".maplibregl-canvas").length,
      selectedPin: Boolean(pin),
      pinLabel: pin?.getAttribute("aria-label") ?? pin?.textContent ?? null,
    }
  })
  record.largeMap = await tab.evaluate(inspect, "[data-map-active]")
  await tab.getByRole("button", { name: "Back to hotel", exact: true }).click()
  await tab.getByRole("region", { name: "Hotel page", exact: true }).waitFor()
  record.back = await tab.evaluate(() => location.pathname + location.search)
  await context.close()
  return record
}

async function fallbackFlow(browser) {
  const { tab, record, context } = await page(browser, { width: 375, height: 812 }, false, { theme: "dark", locale: "ru" })
  await tab.goto(`${base}/hotels/${hotel}`, { waitUntil: "domcontentloaded" })
  await tab.getByRole("region", { name: "Страница отеля", exact: true }).waitFor()
  await tab.locator("[data-hotel-location]").scrollIntoViewIfNeeded()
  await tab.getByText("Мини-карта недоступна", { exact: true }).waitFor()
  record.state = await tab.evaluate(() => ({
    address: document.querySelector("[data-hotel-location] p")?.textContent,
    openMap: [...document.querySelectorAll("button")].some((button) => button.textContent === "Открыть большую карту"),
    overflow: document.documentElement.scrollWidth > innerWidth,
  }))
  await tab.screenshot({ path: `${out}/shots/${motion === "reduce" ? "" : "motion-"}e11-no-webgl-375.png` })
  await context.close()
  return record
}

async function mobileFlow(browser) {
  const { tab, record, context } = await page(browser, { width: 375, height: 812 }, true, { theme: "light", locale: "ru" })
  await tab.goto(`${base}/hotels/${hotel}`, { waitUntil: "domcontentloaded" })
  await tab.getByRole("region", { name: "Страница отеля", exact: true }).waitFor()
  await revealLocation(tab)
  record.mini = await tab.evaluate(inspect, "[data-minimap-active]")
  record.layout = await tab.evaluate(() => {
    const frame = document.querySelector("[data-minimap-active]").getBoundingClientRect()
    return { width: Math.round(frame.width), height: Math.round(frame.height), overflow: document.documentElement.scrollWidth > innerWidth }
  })
  await tab.screenshot({ path: `${out}/shots/${motion === "reduce" ? "" : "motion-"}e11-location-375.png` })
  await context.close()
  return record
}

;(async () => {
  const gl = await chromium.launch({ headless: true, args: webgl })
  const plain = await chromium.launch({ headless: true, args: ["--disable-webgl", "--disable-3d-apis"] })
  const result = {}
  try {
    result.workspace = await workspaceFlow(gl)
    result.directNeon = await directFlow(gl, "neon")
    result.directToy = await directFlow(gl, "toy-town")
    result.mobile = await mobileFlow(gl)
    result.fallback = await fallbackFlow(plain)
  } finally {
    fs.writeFileSync(`${out}/${report}`, JSON.stringify(result, null, 2))
    await gl.close()
    await plain.close()
  }
  const w = result.workspace
  const failures = [
    w.beforeReveal.minimap !== 0 && "minimap created before it was visible",
    w.mini.routes.length === 0 && "minimap lost the selected route",
    w.mini.pitch !== 0 || w.mini.bearing !== 0 ? "minimap rotated" : false,
    (w.mini.scrollZoom || w.mini.dragPan) && "minimap captures gestures",
    w.mini.terrain && "minimap kept terrain",
    w.mini.visibleExtrusions !== 0 && "minimap kept volumes",
    !w.mini.markerInside && "hotel marker is outside the map",
    w.mini.markerOffset.some((value) => Math.abs(value) > 2) && "hotel marker is off its coordinates",
    w.onPage.canvases !== 2 && "more than two map contexts on the hotel page",
    w.onPage.mainActive !== "false" && "hidden main map still active",
    !w.onPage.sameMain && "main map was recreated",
    w.wheel.after === w.wheel.before && "wheel over minimap did not scroll the page",
    !w.focusedUrl.includes(`hotel=${hotel}`) && "route focus selected another hotel",
    !w.fullMap.url.includes("map=full") && "large map did not open",
    w.fullMap.canvases !== 1 && "minimap survived the large map",
    !w.fullMap.sameMain && "large map used a new instance",
    w.fullRoute.routes.length === 0 && "large map lost the route",
    !w.returned.url.startsWith(`/hotels/${hotel}`) && "did not return to the hotel page",
    Math.abs(w.returned.anchor - w.anchorBefore) > 2 && "hotel page reading position not restored",
    Math.abs(w.returned.scroll - w.scrollBefore) > 2 && "hotel page scroll not restored",
    w.leaving.scrolls.length !== 0 && "leaving the page moved its scroll",
    w.returned.routes.length === 0 && "route lost after return",
    w.panel.minimap !== 0 && "minimap left running in the panel",
    result.directNeon.canvases !== 1 && "direct link created the main map eagerly",
    !result.directNeon.large.selectedPin && "direct hotel has no point on the large map",
    result.directNeon.mini.background === result.directToy.mini.background && "minimap ignores appearance",
    result.mobile.layout.overflow && "mobile overflow",
    result.fallback.state.overflow && "fallback overflow",
    ...Object.entries(result).flatMap(([name, value]) => [
      value.errors?.length && `${name} page errors`,
      value.posts?.length && `${name} sent chat POST`,
    ]),
  ].filter(Boolean)
  console.log(JSON.stringify({ failures }, null, 2))
  if (failures.length) process.exit(1)
})().catch((error) => {
  console.error(error)
  process.exit(1)
})

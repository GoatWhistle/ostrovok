const fs = require("node:fs")
const { chromium } = require("/home/ikhail_horokhorin/projects/o-hack-sochi/frontend/node_modules/playwright")

const out = __dirname
const base = process.env.E15_BASE ?? "http://127.0.0.1:5181"
const chat = JSON.parse(fs.readFileSync(`${out}/e12-conversation.json`)).id
const center = [39.7233, 43.5855]

function exposeMap() {
  const element = document.querySelector(".maplibregl-map")
  let fiber = element?.[Object.keys(element).find((key) => key.startsWith("__reactFiber"))]
  while (fiber) {
    let hook = fiber.memoizedState
    for (let index = 0; hook && index < 100; index++, hook = hook.next) {
      const value = hook.memoizedState
      if (value?.current?.getCenter && value.current.jumpTo) {
        window.__map = value.current
        return true
      }
    }
    fiber = fiber.return
  }
  return false
}

function measure(seconds) {
  return new Promise((resolve) => {
    const map = window.__map
    const deltas = []
    const started = performance.now()
    let last
    let step = 0
    const next = () => {
      if (performance.now() - started >= seconds * 1000) return
      step += 1
      const angle = (step / 5) * Math.PI * 2
      map.easeTo({
        center: [39.7233 + 0.006 * Math.cos(angle), 43.5855 + 0.004 * Math.sin(angle)],
        duration: 1500,
        easing: (t) => t,
      })
    }
    map.on("moveend", next)
    const tick = (now) => {
      if (last !== undefined && now - started > 1000) deltas.push(now - last)
      last = now
      if (now - started < seconds * 1000) requestAnimationFrame(tick)
      else {
        map.off("moveend", next)
        map.stop()
        deltas.sort((a, b) => a - b)
        resolve({
          frames: deltas.length,
          p50: Math.round(deltas[Math.floor(deltas.length / 2)] * 10) / 10,
          p95: Math.round(deltas[Math.floor(deltas.length * 0.95)] * 10) / 10,
        })
      }
    }
    requestAnimationFrame(tick)
    next()
  })
}

function layerSummary() {
  const map = window.__map
  const layers = map.getStyle().layers
  const byType = {}
  for (const layer of layers) byType[layer.type] = (byType[layer.type] ?? 0) + 1
  return {
    count: layers.length,
    byType,
    terrain: Boolean(map.getTerrain()),
    custom: layers.filter((layer) => layer.type === "custom").map((layer) => layer.id),
    extrusions: layers.filter((layer) => layer.type === "fill-extrusion").map((layer) => layer.id),
    pixelRatio: map.getPixelRatio(),
    canvas: [map.getCanvas().width, map.getCanvas().height],
  }
}

function toggle({ kind, visible }) {
  const map = window.__map
  const layers = map.getStyle().layers
  const set = (id) => map.setLayoutProperty(id, "visibility", visible ? "visible" : "none")
  if (kind === "terrain") {
    if (visible) map.setTerrain(window.__terrain)
    else {
      window.__terrain = map.getTerrain()
      map.setTerrain(null)
    }
  }
  if (kind === "extrusions")
    for (const layer of layers) if (layer.type === "fill-extrusion") set(layer.id)
  if (kind === "custom") for (const layer of layers) if (layer.type === "custom") set(layer.id)
  if (kind === "symbols") for (const layer of layers) if (layer.type === "symbol") set(layer.id)
  if (kind === "hillshade")
    for (const layer of layers) if (layer.type === "hillshade" || layer.type === "color-relief") set(layer.id)
}

;(async () => {
  const browser = await chromium.launch({
    headless: false,
    args: ["--enable-webgl", "--ignore-gpu-blocklist", "--window-size=1440,960"],
    env: { ...process.env, GALLIUM_DRIVER: "d3d12" },
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  page.setDefaultTimeout(60000)
  await page.addInitScript(() => {
    localStorage.setItem("app-locale", "ru")
    localStorage.setItem("app-theme", "dark")
  })
  const result = { steps: [] }
  try {
    await page.goto(`${base}/?chat=${chat}&map=full&tab=map`)
    await page.locator('[data-map-active="true"]').waitFor()
    await page.waitForFunction(exposeMap)
    await page.evaluate((point) => window.__map.jumpTo({ center: point, zoom: 15, pitch: 55, bearing: 0 }), center)
    await page.waitForTimeout(8000)
    result.layers = await page.evaluate(layerSummary)
    const run = async (name) => result.steps.push({ name, ...(await page.evaluate(measure, 8)) })
    await run("baseline")
    for (const kind of ["terrain", "extrusions", "custom", "hillshade", "symbols"]) {
      await page.evaluate(toggle, { kind, visible: false })
      await page.waitForTimeout(1500)
      await run(`without ${kind}`)
      await page.evaluate(toggle, { kind, visible: true })
      await page.waitForTimeout(1500)
    }
    for (const kind of ["terrain", "extrusions", "custom", "hillshade"])
      await page.evaluate(toggle, { kind, visible: false })
    await page.waitForTimeout(1500)
    await run("without terrain, extrusions, custom, hillshade")
    await page.evaluate(() => window.__map.setPitch(0))
    await page.waitForTimeout(1500)
    await run("flat pitch 0, same reductions")
  } finally {
    fs.writeFileSync(`${out}/e15-diagnosis.json`, `${JSON.stringify(result, null, 2)}\n`)
    await browser.close()
  }
  console.log(JSON.stringify(result.layers))
  for (const step of result.steps) console.log(step.name, step.p50, step.p95, step.frames)
})().catch((error) => {
  console.error(error)
  process.exit(1)
})

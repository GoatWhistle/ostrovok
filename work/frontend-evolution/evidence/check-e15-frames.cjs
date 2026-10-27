const fs = require("node:fs")
const { chromium } = require("/home/ikhail_horokhorin/projects/o-hack-sochi/frontend/node_modules/playwright")

const out = __dirname
const base = process.env.E15_BASE ?? "http://127.0.0.1:5181"
const chat = JSON.parse(fs.readFileSync(`${out}/e12-conversation.json`)).id
const sites = [
  { name: "center", center: [39.7233, 43.5855] },
  { name: "shore", center: [39.9668263, 43.3989565] },
  { name: "mountain", center: [40.312, 43.666] },
]
const PAN_MS = Number(process.env.E15_PAN_MS ?? 30000)

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

function renderer() {
  const gl = document.createElement("canvas").getContext("webgl2")
  const ext = gl?.getExtension("WEBGL_debug_renderer_info")
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "unknown"
}

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] : null
}

async function idle(page, timeout = 30000) {
  return page.evaluate(
    (limit) =>
      new Promise((resolve) => {
        const map = window.__map
        const started = performance.now()
        const done = () => resolve(Math.round(performance.now() - started))
        map.once("idle", done)
        map.triggerRepaint()
        setTimeout(() => resolve(null), limit)
      }),
    timeout,
  )
}

async function switchTimes(page) {
  await page.getByRole("button", { name: "Оформление карты" }).click()
  const pick = (label) =>
    page.evaluate(
      (name) =>
        new Promise((resolve) => {
          const input = [...document.querySelectorAll("input[type=radio]")].find(
            (item) => item.closest("label")?.textContent?.includes(name),
          )
          const map = window.__map
          const started = performance.now()
          let frame
          const timer = setTimeout(() => resolve({ frame: null, idle: null }), 10000)
          const render = () => {
            frame ??= Math.round(performance.now() - started)
          }
          map.on("render", render)
          map.once("idle", () => {
            clearTimeout(timer)
            map.off("render", render)
            resolve({ frame: frame ?? null, idle: Math.round(performance.now() - started) })
          })
          input.click()
          map.triggerRepaint()
        }),
      label,
    )
  const warm = [await pick("Игрушечный город"), await pick("Ночной город")]
  const samples = []
  for (let index = 0; index < 10; index++)
    samples.push(await pick(index % 2 === 0 ? "Игрушечный город" : "Ночной город"))
  await page.keyboard.press("Escape")
  const frames = samples.map((item) => item.frame).filter((item) => item !== null)
  const idles = samples.map((item) => item.idle).filter((item) => item !== null)
  return { warm, samples, p95Frame: percentile(frames, 95), p95Idle: percentile(idles, 95) }
}

async function pan(page, site) {
  await page.evaluate((center) => window.__map.jumpTo({ center, zoom: 15, pitch: 55, bearing: 0 }), site.center)
  const load = await idle(page)
  const result = await page.evaluate(
    ({ center, duration }) =>
      new Promise((resolve) => {
        const map = window.__map
        const frames = []
        const quality = []
        const started = performance.now()
        let last
        let step = 0
        const radius = 0.006
        const next = () => {
          if (performance.now() - started >= duration) return
          step += 1
          const angle = (step / 5) * Math.PI * 2
          map.easeTo({
            center: [center[0] + radius * Math.cos(angle), center[1] + radius * 0.7 * Math.sin(angle)],
            duration: 2000,
            easing: (t) => t,
          })
        }
        map.on("moveend", next)
        const visible = (id) =>
          map.getLayer(id) ? map.getLayoutProperty(id, "visibility") !== "none" : null
        const probe = setInterval(
          () =>
            quality.push({
              t: Math.round(performance.now() - started),
              glow: visible("base-roads-glow"),
              volumes: visible("scene-volumes") ?? visible("overview-volumes"),
            }),
          1000,
        )
        const tick = (now) => {
          if (last !== undefined) frames.push({ t: now - started, ms: now - last })
          last = now
          if (now - started < duration) requestAnimationFrame(tick)
          else {
            clearInterval(probe)
            map.off("moveend", next)
            map.stop()
            resolve({ frames, quality })
          }
        }
        requestAnimationFrame(tick)
        next()
      }),
    { center: site.center, duration: PAN_MS },
  )
  const settled = result.frames.filter((frame) => frame.t >= PAN_MS / 3).map((frame) => frame.ms)
  const all = result.frames.map((frame) => frame.ms)
  return {
    site: site.name,
    loadMs: load,
    frames: all.length,
    p50: percentile(all, 50),
    p95All: percentile(all, 95),
    p95AfterAdaptation: percentile(settled, 95),
    over33: settled.filter((ms) => ms > 33).length,
    settledFrames: settled.length,
    quality: result.quality.filter((_, index) => index % 5 === 0 || index === result.quality.length - 1),
  }
}

;(async () => {
  const browser = await chromium.launch({
    headless: false,
    args: ["--enable-webgl", "--ignore-gpu-blocklist", "--window-size=1440,960"],
    env: { ...process.env, GALLIUM_DRIVER: "d3d12" },
  })
  const result = { base, panMs: PAN_MS, runs: [] }
  try {
    for (const mode of ["cold", "warm"]) {
      const context =
        mode === "cold" || !result.context
          ? await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
          : result.context
      result.context = context
      const page = context.pages()[0] ?? (await context.newPage())
      page.setDefaultTimeout(60000)
      const errors = []
      page.on("pageerror", (error) => errors.push(error.message))
      if (mode === "cold") {
        await page.addInitScript(() => {
          localStorage.setItem("app-locale", "ru")
          localStorage.setItem("app-theme", "dark")
        })
        await page.goto(`${base}/?chat=${chat}&map=full&tab=map`)
      }
      await page.locator('[data-map-active="true"]').waitFor()
      await page.waitForFunction(exposeMap)
      result.renderer ??= await page.evaluate(renderer)
      const run = { mode, firstIdleMs: await idle(page, 60000), pans: [], errors }
      for (const site of sites) run.pans.push(await pan(page, site))
      run.appearance = await switchTimes(page)
      result.runs.push(run)
    }
  } finally {
    delete result.context
    fs.writeFileSync(`${out}/e15-frames.json`, `${JSON.stringify(result, null, 2)}\n`)
    await browser.close()
  }
  for (const run of result.runs)
    console.log(
      run.mode,
      JSON.stringify(run.pans.map((item) => [item.site, item.loadMs, item.p95AfterAdaptation, item.p50])),
      "switch p95 frame/idle",
      run.appearance.p95Frame,
      run.appearance.p95Idle,
    )
  console.log("renderer", result.renderer)
})().catch((error) => {
  console.error(error)
  process.exit(1)
})

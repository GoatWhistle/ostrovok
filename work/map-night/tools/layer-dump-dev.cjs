const fs = require("node:fs")
const { chromium } = require("/home/ikhail_horokhorin/projects/o-hack/frontend/node_modules/playwright")
const copy = require("/home/ikhail_horokhorin/projects/o-hack-sochi/frontend/src/shared/i18n/locales/ru/explore.json")
const base = process.env.BASE ?? "http://127.0.0.1:5181"
const out = process.argv[2]
const look = process.env.LOOK ?? "toy-town"
const hour = Number(process.env.HOUR ?? 22)
fs.mkdirSync(out, { recursive: true })
async function setHour(page, h) {
  const trigger = page.getByRole("button", { name: new RegExp(`^${copy.weather.scene}`) }).first()
  if ((await page.getByRole("button", { name: copy.weather.nextHour }).count()) === 0) await trigger.click()
  const clock = page.locator("output[aria-live='polite']").last()
  for (let step = 0; step < 24; step += 1) {
    const current = Number.parseInt((await clock.textContent()) ?? "0", 10)
    if (current === h) break
    await page.getByRole("button", { name: current < h ? copy.weather.nextHour : copy.weather.previousHour }).click()
  }
  await page.keyboard.press("Escape")
}
;(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`, args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce", locale: "ru-RU" })
  await context.addInitScript(() => { localStorage.setItem("app-locale", "ru"); performance.setResourceTimingBufferSize(100000) })
  const page = await context.newPage()
  page.setDefaultTimeout(90000)
  const errors = []
  page.on("pageerror", (e) => errors.push(e.message))
  await page.goto(`${base}/?chat=${process.env.CHAT ?? "0628d9fc-70af-4a56-9c83-2a23d1d4e8c1"}&hotel=${process.env.HOTEL_ID ?? "n12749552601"}&style=${look}${process.env.FULL ? "&map=full" : ""}`, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(15000)
  await page.evaluate(async () => {
    const url = performance.getEntriesByType("resource").map((e) => e.name).find((n) => /deps\/maplibre-gl\.js/.test(n))
    const mod = await import(url)
    const M = (mod.default ?? mod).Map
    window.__maps = new Set()
    const orig = M.prototype.triggerRepaint
    M.prototype.triggerRepaint = function (...a) { window.__maps.add(this); return orig.apply(this, a) }
  })
  if (process.env.PRE_HOUR) { await setHour(page, Number(process.env.PRE_HOUR)); await page.waitForTimeout(6000) }
  await setHour(page, hour)
  await page.mouse.move(900, 500); await page.mouse.move(905, 505)
  await page.waitForTimeout(8000)
  const info = await page.evaluate(() => {
    const maps = [...window.__maps]
    const map = maps.sort((a, b) => b.getContainer().clientWidth - a.getContainer().clientWidth)[0]
    window.__map = map
    const style = map.getStyle()
    return {
      zoom: map.getZoom(), pitch: map.getPitch(), center: map.getCenter(),
      layers: style.layers.map((l) => {
        const p = l.paint ?? {}
        const keep = {}
        for (const [k, v] of Object.entries(p)) if (/color|opacity|width/.test(k)) keep[k] = typeof v === "string" || typeof v === "number" ? v : JSON.stringify(v).slice(0, 220)
        return { id: l.id, type: l.type, vis: l.layout?.visibility ?? "visible", minzoom: l.minzoom, paint: keep }
      }),
      light: style.light, sky: style.sky,
    }
  })
  fs.writeFileSync(`${out}/${look}-${process.env.PRE_HOUR ?? ""}-${hour}-layers.json`, JSON.stringify(info, null, 1))
  await page.screenshot({ path: `${out}/${look}-${process.env.PRE_HOUR ?? ""}-${hour}.png`, animations: "disabled" })
  for (const group of (process.env.HIDE ?? "").split(";").filter(Boolean)) {
    const ids = group.split(",")
    await page.evaluate((ids) => { for (const id of ids) if (window.__map.getLayer(id)) window.__map.setLayoutProperty(id, "visibility", "none"); window.__map.triggerRepaint() }, ids)
    await page.waitForTimeout(2500)
    await page.screenshot({ path: `${out}/${look}-${hour}-hide-${ids[0]}.png`, animations: "disabled" })
    await page.evaluate((ids) => { for (const id of ids) if (window.__map.getLayer(id)) window.__map.setLayoutProperty(id, "visibility", "visible") }, ids)
  }
  console.log(JSON.stringify({ errors, zoom: info.zoom, pitch: info.pitch, n: info.layers.length }))
  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })

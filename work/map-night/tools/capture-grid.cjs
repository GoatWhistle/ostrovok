const fs = require("node:fs")
const { chromium } = require("/home/ikhail_horokhorin/projects/o-hack/frontend/node_modules/playwright")
const copy = require("/home/ikhail_horokhorin/projects/o-hack-sochi/frontend/src/shared/i18n/locales/ru/explore.json")
const base = process.env.BASE ?? "http://127.0.0.1:5181"
const out = process.argv[2] ?? "work/map-night/before/grid"
const looks = (process.env.LOOKS ?? "toy-town,neon").split(",")
const hours = (process.env.HOURS ?? "13,14,15,16,17,18,19,20,21,22,23,0,1,2,3,4,5,6,7,8,9,10,11,12").split(",").map(Number)
const shots = (process.env.SHOTS ?? "13,17,18,19,22,2").split(",").map(Number)
const zooms = (process.env.ZOOMS ?? "13,15,17").split(",").map(Number)
const widths = (process.env.WIDTHS ?? "1440,375").split(",").map(Number)
fs.mkdirSync(out, { recursive: true })
async function setHour(page, h) {
  const trigger = page.getByRole("button", { name: new RegExp(`^${copy.weather.scene}`) }).first()
  await trigger.waitFor({ timeout: 240000 })
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
  for (const look of looks) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce", locale: "ru-RU" })
    await context.addInitScript(() => { localStorage.setItem("app-locale", "ru"); performance.setResourceTimingBufferSize(100000) })
    const page = await context.newPage()
    page.setDefaultTimeout(90000)
    const errors = []
    page.on("pageerror", e => errors.push(e.message))
    await page.goto(`${base}/?chat=${process.env.CHAT}&hotel=n12749552601&style=${look}&map=full`, { waitUntil: "domcontentloaded" })
    console.log(`${look}: loaded`)
    await page.waitForTimeout(12000)
    await page.evaluate(async () => {
      const url = performance.getEntriesByType("resource").map(e => e.name).find(n => /deps\/maplibre-gl\.js/.test(n))
      const mod = await import(url)
      const M = (mod.default ?? mod).Map
      window.__maps = new Set()
      const orig = M.prototype.triggerRepaint
      M.prototype.triggerRepaint = function (...a) { window.__maps.add(this); return orig.apply(this, a) }
    })
    console.log(`${look}: connected`)
    await setHour(page, 13)
    await page.waitForTimeout(3000)
    await page.evaluate(() => { window.__map = [...window.__maps].sort((a,b) => b.getContainer().clientWidth-a.getContainer().clientWidth)[0] })
    console.log(`${look}: ready`)
    for (const hour of hours) {
      console.log(`${look} ${hour}: setting`)
      await setHour(page, hour)
      await page.waitForTimeout(1500)
      console.log(`${look} ${hour}: reading`)
      const snapshot = await page.evaluate(async () => {
        const map = window.__map
        const roof = await import("/src/shared/geo/roof-mesh/layer.ts")
        const tree = await import("/src/shared/geo/tree-mesh/layer.ts")
        const full = map.getStyle()
        const style = { light: full.light, sky: full.sky, layers: full.layers.map(({ id, type, paint, layout, minzoom, maxzoom }) => ({ id, type, paint, visibility: layout?.visibility, minzoom, maxzoom })) }
        return { style, roofs: roof.roofMeshOf(map)?.lighting ?? null, trees: tree.treeLayerOf(map)?.lighting ?? null, center: map.getCenter(), zoom: map.getZoom(), date: new Date().toISOString() }
      })
      fs.writeFileSync(`${out}/${look}-${hour}.json`, JSON.stringify({ look, hour, ...snapshot, errors }, null, 2))
      if (shots.includes(hour)) {
        for (const width of widths) {
          await page.setViewportSize({ width, height: width===375 ? 812 : 900 })
          for (const zoom of zooms) {
            await page.evaluate(zoom => { window.__map.resize(); window.__map.jumpTo({zoom}) }, zoom)
            await page.waitForTimeout(2200)
            await page.screenshot({path:`${out}/${look}-${hour}-${zoom}-${width}.png`, animations:"disabled"})
          }
        }
        await page.setViewportSize({width:1440,height:900})
        await page.evaluate(() => { window.__map.resize(); window.__map.jumpTo({zoom:17}) })
      }
      console.log(`${look} ${hour}: captured`)
    }
    await context.close()
  }
  await browser.close()
})().catch(e => { console.error(e); process.exit(1) })

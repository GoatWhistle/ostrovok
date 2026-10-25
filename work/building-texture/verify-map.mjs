import assert from "node:assert/strict"
import { readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { resolve } from "node:path"

const require = createRequire(resolve("frontend/package.json"))
const { chromium } = require("@playwright/test")
const base = process.env.TEXTURE_BASE_URL ?? "http://127.0.0.1:5181"
const conversationId = process.env.TEXTURE_CONVERSATION_ID ?? "1c80287c-0a31-4a68-afa0-af1f93159c02"
const conversation = await fetch(`${base}/api/v1/chat/conversations/${conversationId}`).then((r) => r.json())
const hotels = conversation.search.results.filter((item) => item.footprint && item.hotel.height_m > 0).slice(0, 2)
assert.equal(hotels.length, 2, "The saved conversation needs two real hotels with footprints")
const browser = await chromium.launch({ headless: true })
const reports = []

async function open(width, locale, theme, mode = "normal") {
  const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: "reduce" })
  const copy = JSON.parse(readFileSync(`frontend/src/shared/i18n/locales/${locale}/explore.json`))
  const errors = []
  let modelCalls = 0
  page.on("pageerror", (error) => errors.push(String(error)))
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/chat/messages")) modelCalls++
  })
  await page.addInitScript(({ locale, theme, conversationId, mode }) => {
    localStorage.setItem("app-locale", locale)
    localStorage.setItem("app-theme", theme)
    localStorage.setItem("hotel-agent-conversation", conversationId)
    const live = new Set()
    const draws = []
    const prototype = WebGL2RenderingContext.prototype
    const draw = prototype.drawArrays
    const remove = prototype.deleteProgram
    const parameter = prototype.getShaderParameter
    prototype.drawArrays = function (...args) {
      const program = this.getParameter(this.CURRENT_PROGRAM)
      if (program && this.getUniformLocation(program, "u_daylight")) {
        live.add(program)
        draws.push({ hotel: document.querySelector("[data-textured-hotel]")?.dataset.texturedHotel, count: args[2] })
      }
      return draw.apply(this, args)
    }
    prototype.deleteProgram = function (program) {
      live.delete(program)
      return remove.call(this, program)
    }
    if (mode === "shader-failure") {
      prototype.getShaderParameter = function (shader, name) {
        if (name === this.COMPILE_STATUS && this.getShaderSource(shader)?.includes("a_uv")) return false
        return parameter.call(this, shader, name)
      }
    }
    document.addEventListener("webglcontextlost", () => live.clear(), true)
    window.textureProbe = { live, draws }
  }, { locale, theme, conversationId, mode })
  if (mode === "image-failure") await page.route("**/textures/hotel-albedo-v1.jpg", (route) => route.fulfill({ status: 404, body: "Missing" }))
  await page.goto(base)
  if (width < 1024) await page.getByRole("radio", { name: copy.panel.hotels, exact: true }).check()
  async function choose(index) {
    if (width < 1024) await page.getByRole("radio", { name: copy.panel.hotels, exact: true }).check()
    await page.getByRole("button", { name: hotels[index].hotel.name, exact: true }).click()
    if (width < 1024) await page.getByRole("radio", { name: copy.panel.map, exact: true }).check()
  }
  async function clear() {
    if (width < 1024) await page.getByRole("radio", { name: copy.panel.hotels, exact: true }).check()
    await page.getByRole("button", { name: copy.panel.back, exact: true }).click()
    await page.waitForFunction(() => !document.querySelector("[data-textured-hotel]") && window.textureProbe.live.size === 0)
  }
  async function textured(index) {
    await page.waitForSelector(`[data-textured-hotel="${hotels[index].hotel.id}"]`)
    await page.waitForFunction(() => window.textureProbe.live.size === 1)
    assert.equal(await page.locator("[data-textured-hotel]").count(), 1)
  }
  return { page, copy, errors, choose, clear, textured, modelCalls: () => modelCalls }
}

try {
  for (const width of [1440, 375]) {
    for (const locale of ["ru", "en"]) {
      for (const theme of ["light", "dark"]) {
        const run = await open(width, locale, theme)
        await run.choose(0)
        await run.textured(0)
        await run.clear()
        await run.choose(1)
        await run.textured(1)
        await run.page.waitForTimeout(500)
        const screenshot = `work/building-texture/map-${width}-${locale}-${theme}.png`
        await run.page.screenshot({ path: screenshot, fullPage: true })
        const overflow = await run.page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
        assert.equal(overflow, false)
        assert.deepEqual(run.errors, [])
        assert.equal(run.modelCalls(), 0)
        reports.push({ width, locale, theme, screenshot, selected: hotels[1].hotel.id,
          deselectionReleasedGpu: true, liveTexturedPrograms: 1, overflow, errors: run.errors, modelCalls: 0 })
        await run.page.close()
      }
    }
  }
  for (const mode of ["image-failure", "shader-failure"]) {
    const run = await open(1440, "ru", "light", mode)
    await run.choose(0)
    await run.page.getByText(run.copy.map.textureUnavailable, { exact: true }).waitFor()
    assert.equal(await run.page.locator("[data-textured-hotel]").count(), 0)
    assert.equal(await run.page.evaluate(() => window.textureProbe.live.size), 0)
    await run.page.screenshot({ path: `work/building-texture/map-${mode}.png`, fullPage: true })
    assert.deepEqual(run.errors, [])
    reports.push({ scenario: mode, standardVolumeRetained: true, activeTexturedPrograms: 0, errors: run.errors })
    await run.page.close()
  }
  const delayed = await open(1440, "ru", "light")
  let release
  const gate = new Promise((resolve) => { release = resolve })
  await delayed.page.route("**/textures/hotel-albedo-v1.jpg", async (route) => { await gate; await route.continue() })
  await delayed.choose(0)
  await delayed.clear()
  await delayed.choose(1)
  release()
  await delayed.textured(1)
  const renderedHotels = await delayed.page.evaluate(() => [...new Set(window.textureProbe.draws.map((draw) => draw.hotel).filter(Boolean))])
  assert.deepEqual(renderedHotels, [hotels[1].hotel.id])
  reports.push({ scenario: "late-image-after-selection-change", renderedHotels })
  await delayed.page.close()
  const restored = await open(1440, "ru", "light")
  await restored.choose(0)
  await restored.textured(0)
  const supported = await restored.page.evaluate(() => {
    const canvas = document.querySelector("canvas.maplibregl-canvas")
    const extension = canvas.getContext("webgl2").getExtension("WEBGL_lose_context")
    window.contextExtension = extension
    extension?.loseContext()
    return extension !== null
  })
  assert.equal(supported, true)
  await restored.page.waitForFunction(() => window.textureProbe.live.size === 0)
  await restored.page.evaluate(() => window.contextExtension.restoreContext())
  await restored.textured(0)
  assert.deepEqual(restored.errors, [])
  reports.push({ scenario: "webgl-context-restored", liveTexturedPrograms: 1, errors: restored.errors })
  await restored.page.close()
} finally {
  writeFileSync("work/building-texture/map-browser-check.json", `${JSON.stringify({
    checkedAt: new Date().toISOString(), base, conversationId, hotels: hotels.map((item) => item.hotel), reports,
  }, null, 2)}\n`)
  await browser.close()
}
console.log(JSON.stringify({ scenarios: reports.length, passed: true, paidModelCalls: 0 }))

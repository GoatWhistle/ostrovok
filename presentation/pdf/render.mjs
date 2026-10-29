import { createRequire } from "node:module"
import { writeFileSync, statSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const presentationRequire = createRequire(join(here, "..", "package.json"))
const frontendRequire = createRequire(join(here, "..", "..", "frontend", "package.json"))
const qrcode = presentationRequire("qrcode-generator")
const { chromium } = frontendRequire("playwright")

const qr = qrcode(0, "M")
qr.addData("https://factmap.goatwhistle.ru")
qr.make()
const count = qr.getModuleCount()
const quiet = 2
const size = count + quiet * 2
let rects = ""
for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) if (qr.isDark(r, c)) rects += `M${c + quiet} ${r + quiet}h1v1h-1z`
writeFileSync(join(here, "qr.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${rects}" fill="#0d1b22"/></svg>`)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.goto(pathToFileURL(join(here, "index.html")).href, { waitUntil: "networkidle" })
await page.evaluate(() => document.fonts.ready)
const pdfPath = join(here, "..", "factmap.pdf")
await page.pdf({ path: pdfPath, width: "1920px", height: "1080px", printBackground: true, preferCSSPageSize: true })
const slides = await page.$$("section.slide")
const picked = process.argv.slice(2).map(Number)
for (const n of picked.length ? picked : [1, 4, 7]) await slides[n - 1].screenshot({ path: join(here, "preview", `slide-${n}.png`) })
console.log(slides.length, statSync(pdfPath).size)
await browser.close()

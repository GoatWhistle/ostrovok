import { readFileSync, readdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, "..", "logo-gallery.html")

const families = {
  "bricolage-grotesque": "Bricolage Grotesque",
  fraunces: "Fraunces",
  geologica: "Geologica",
  inter: "Inter",
  "jetbrains-mono": "JetBrains Mono",
  manrope: "Manrope",
  onest: "Onest",
  oswald: "Oswald",
  outfit: "Outfit",
  sora: "Sora",
  "space-grotesk": "Space Grotesk",
  unbounded: "Unbounded",
}

const fonts = readdirSync(join(here, "fonts"))
  .filter((f) => f.endsWith(".woff2"))
  .map((f) => {
    const id = f.replace(".woff2", "")
    const data = readFileSync(join(here, "fonts", f)).toString("base64")
    return `@font-face{font-family:"${families[id]}";font-weight:100 900;font-display:swap;src:url(data:font/woff2;base64,${data}) format("woff2")}`
  })
  .join("\n")

const strip = (src) =>
  src
    .split("\n")
    .filter((line) => !line.startsWith("import "))
    .join("\n")
    .replace(/^export /gm, "")

const js = ["symbols.js", "catalog.js", "app.js"].map((f) => strip(readFileSync(join(here, f), "utf8"))).join("\n")
const css = readFileSync(join(here, "gallery.css"), "utf8")
const html = readFileSync(join(here, "index.html"), "utf8")
  .replace("/*FONTS*/", () => fonts)
  .replace("/*CSS*/", () => css)
  .replace("/*JS*/", () => js)

writeFileSync(out, html)
console.log(`${out} ${(html.length / 1024).toFixed(0)} KB`)

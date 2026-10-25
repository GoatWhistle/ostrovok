import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { icon } from "./icons.js"

const here = dirname(fileURLToPath(import.meta.url))
const read = (f) => readFileSync(join(here, f), "utf8")
const out = join(here, "..", "factmap-design-system.html")

const RANGES = {
  latin: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
  "latin-ext": "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1E00-1E9F,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF",
  cyrillic: "U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116",
}
const FAMILIES = { manrope: "Manrope", "jetbrains-mono": "JetBrains Mono" }

const fonts = Object.entries(FAMILIES)
  .flatMap(([id, family]) =>
    Object.entries(RANGES).map(([sub, range]) => {
      const data = readFileSync(join(here, "fonts", `${id}-${sub}.woff2`)).toString("base64")
      return `@font-face{font-family:"${family}";font-style:normal;font-weight:100 900;font-display:swap;src:url(data:font/woff2;base64,${data}) format("woff2");unicode-range:${range}}`
    }),
  )
  .join("\n")

const PANELS = (l, m, r) => `<path class="mk-side mk-l" ${l} d="M5 14 22 8v42L5 56Z"/><path class="mk-mid" ${m} d="M25 8l14 6v42l-14-6Z"/><path class="mk-side mk-r" ${r} d="M42 14 59 8v42l-17 6Z"/>`

const mark = (variant) => {
  const panels = PANELS("", "", "")
  if (!variant) return `<svg class="lockup-mark mk-auto" viewBox="0 0 64 64" aria-hidden="true">${panels}</svg>`
  if (variant === "fixed") return `<svg class="lockup-mark" viewBox="0 0 64 64" aria-hidden="true">${panels}</svg>`
  if (variant === "unfold") return `<svg class="lockup-mark mk-auto mk-unfold" viewBox="0 0 64 64" aria-hidden="true">${panels}</svg>`
  const w = variant.slice(1)
  return `<svg class="mk-auto" viewBox="0 0 64 64" width="${w}" height="${w}" aria-hidden="true" style="display:block">${panels}</svg>`
}

const tile = (bg, side, mid, inset = 10) => {
  const s = (64 - inset * 2) / 64
  return `<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">${bg ? `<rect width="64" height="64" rx="14" fill="${bg}"/>` : ""}<g transform="translate(${inset} ${inset}) scale(${s})">${PANELS(`style="fill:${side}"`, `style="fill:${mid}"`, `style="fill:${side}"`)}</g></svg>`
}

const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#1546db"/><g transform="translate(7 7) scale(.78)">${PANELS('fill="#ffffff"', 'fill="#b0ea55"', 'fill="#ffffff"')}</g></svg>`
const favicon = `data:image/svg+xml,${encodeURIComponent(faviconSvg)}`

const themeBoot = `(function(){var t=null;try{t=localStorage.getItem("fm-theme")}catch(e){}if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t})()`

const strip = (src) =>
  src
    .split("\n")
    .filter((line) => !line.startsWith("import "))
    .join("\n")
    .replace(/^export /gm, "")

const js = ["icons.js", "data.js", "i18n.js", "map.js", "motion.js", "viz.js", "chat.js", "screens.js", "app.js"].map((f) => strip(read(f))).join("\n")
const css = ["tokens.css", "keyframes.css", "doc.css", "components.css", "map.css", "extra.css", "chat.css"].map(read).join("\n")

const html = read("index.html")
  .replace(/\{\{PART:([a-z0-9-]+)\}\}/g, (_, name) => read(`parts/${name}.html`))
  .replace("{{TOKENS_SRC}}", () => read("tokens.css").replaceAll("<", "&lt;"))
  .replace(/\{\{i:([a-z-]+)(?::(\d+))?(?::([^}]+))?\}\}/g, (_, name, size, cls) => icon(name, size ? Number(size) : 20, cls ?? ""))
  .replace(/\{\{MARK(?::([a-z0-9]+))?\}\}/g, (_, v) => mark(v))
  .replaceAll("{{FAVICON}}", favicon)
  .replaceAll("{{APPICON}}", tile(null, "#ffffff", "#b0ea55", 14))
  .replaceAll("{{APPICON_LIME}}", tile(null, "#1546db", "#12140f", 16))
  .replace("{{THEME_BOOT}}", () => themeBoot)
  .replace("{{FONTS}}", () => fonts)
  .replace("{{CSS}}", () => css)
  .replace("{{JS}}", () => js)

const left = html.match(/\{\{[^}]+\}\}/g)?.filter((m) => !m.includes("x, number"))
if (left?.length) console.warn("unresolved", left)
writeFileSync(out, html)
console.log(`${out} ${(html.length / 1024).toFixed(0)} KB`)

import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium, type Page } from "@playwright/test"
import {
  CARD_THEME,
  ICO_SIZES,
  type Locale,
  MANIFEST,
  META_LOCALE,
  ogFile,
  RASTERS,
  type RasterAsset,
} from "./brand/assets.ts"
import { buildIco, type PngImage } from "./brand/binary.ts"
import {
  FAVICON_TILE,
  faviconSvg,
  onFact,
  onSurface,
  onTile,
  paintedMark,
  readMark,
  readPalette,
  tileSvg,
} from "./brand/marks.ts"
import { cardHtml, svgHtml } from "./brand/pages.ts"
import { pickFontFaces } from "./exportTokens.ts"

interface CommonWords {
  readonly app: { readonly name: string; readonly tagline: string; readonly wordmark: string }
  readonly meta: { readonly description: string }
}

const FONT_PACKAGE = "@fontsource-variable/manrope"

const frontendRoot = resolve(fileURLToPath(new URL("..", import.meta.url)))
const repoRoot = resolve(frontendRoot, "..")
const publicDir = join(frontendRoot, "public")
const LOCALES: readonly Locale[] = ["ru", "en"]

function words(locale: Locale): CommonWords {
  const file = join(frontendRoot, "src", "shared", "i18n", "locales", locale, "common.json")
  return JSON.parse(readFileSync(file, "utf8")) as CommonWords
}

function fontFaces(): string {
  const packageDir = join(frontendRoot, "node_modules", ...FONT_PACKAGE.split("/"))
  const faces = pickFontFaces(readFileSync(join(packageDir, "index.css"), "utf8"))
  return faces.files.reduce((css, file) => {
    const data = readFileSync(join(packageDir, "files", file)).toString("base64")
    return css.replaceAll(`url("fonts/${file}")`, `url("data:font/woff2;base64,${data}")`)
  }, faces.css)
}

function fontFamily(): string {
  const css = readFileSync(
    join(frontendRoot, "src", "shared", "styles", "tokens", "typography.css"),
    "utf8",
  )
  return /--font-sans:\s*([^;]+);/.exec(css)?.[1]?.replace(/\s+/g, " ").trim() ?? "sans-serif"
}

function write(file: string, data: string | Buffer): void {
  const target = join(publicDir, file)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, data)
}

async function shoot(page: Page, html: string): Promise<Buffer> {
  await page.setContent(html)
  await page.evaluate(() => document.fonts.ready)
  return page.locator("#asset").screenshot({ omitBackground: true })
}

const mark = readMark(repoRoot)
const palette = readPalette(frontendRoot)
const light = palette.light

function rasterSvg(asset: RasterAsset): string {
  if (asset.kind === "maskable") return tileSvg(mark, asset, onFact(light), light.fact)
  return tileSvg(mark, asset, onTile(light), light.tile)
}

write("favicon.svg", faviconSvg(mark, palette))

const browser = await chromium.launch()
const page = await browser.newPage({ deviceScaleFactor: 1 })
const ico: PngImage[] = []
const tab = tileSvg(mark, FAVICON_TILE, onTile(light), light.tile)
for (const size of ICO_SIZES) ico.push({ size, data: await shoot(page, svgHtml(tab, size)) })
write("favicon.ico", buildIco(ico))
for (const asset of RASTERS)
  write(asset.file, await shoot(page, svgHtml(rasterSvg(asset), asset.size)))
const fonts = fontFaces()
const family = fontFamily()
for (const locale of LOCALES) {
  const text = words(locale)
  const colors = palette[CARD_THEME[locale]]
  const card = { wordmark: text.app.wordmark, tagline: text.app.tagline }
  const painted = paintedMark(mark, onSurface(colors))
  write(ogFile(locale), await shoot(page, cardHtml(painted, card, colors, fonts, family)))
}
await browser.close()

const meta = words(META_LOCALE)
const manifest = {
  name: meta.app.name,
  short_name: meta.app.name,
  description: meta.meta.description,
  lang: META_LOCALE,
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: light.surface,
  theme_color: light.surface,
  icons: RASTERS.filter((asset) => asset.file.startsWith("icons/")).map((asset) => ({
    src: `/${asset.file}`,
    sizes: `${asset.size}x${asset.size}`,
    type: "image/png",
    purpose: asset.kind === "maskable" ? "maskable" : "any",
  })),
}
write(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)

process.stdout.write(
  `public/: favicon.svg (light and dark), favicon.ico ${ICO_SIZES.join("/")}, ${RASTERS.map((asset) => asset.file).join(", ")}, ${LOCALES.map(ogFile).join(", ")}, ${MANIFEST}\n`,
)

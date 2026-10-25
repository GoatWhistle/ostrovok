import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type { ThemeName } from "../checks/themes.ts"
import { readTokenSources, themeColor } from "../tokenSources.ts"

export interface ThemePalette {
  readonly side: string
  readonly fact: string
  readonly tile: string
  readonly onTile: string
  readonly surface: string
  readonly text: string
}

export type BrandPalette = Readonly<Record<ThemeName, ThemePalette>>

export interface Mark {
  readonly viewBox: string
  readonly body: string
}

export interface MarkColors {
  readonly base: string
  readonly accent: string
}

export interface Tile {
  readonly radius: number
  readonly scale: number
}

const SVG = /<svg\b[^>]*\bviewBox="([^"]+)"[^>]*>([\s\S]*?)<\/svg>/
const SHELL_MARK = /<template id="brand-mark">\s*([\s\S]*?)\s*<\/template>/

const PALETTE_TOKENS: Readonly<Record<keyof ThemePalette, string>> = {
  side: "--mark-side",
  fact: "--mark-fact",
  tile: "--action-primary",
  onTile: "--action-primary-text",
  surface: "--surface-base",
  text: "--text-primary",
}

export const FAVICON_TILE: Tile = { radius: 14 / 64, scale: 0.78 }

export function readMark(repoRoot: string): Mark {
  const symbol = join(repoRoot, "docs", "brand", "symbol.svg")
  const shell = join(repoRoot, "presentation", "src", "shell.html")
  const svg = existsSync(symbol)
    ? readFileSync(symbol, "utf8")
    : (SHELL_MARK.exec(readFileSync(shell, "utf8"))?.[1] ?? "")
  const match = SVG.exec(svg)
  if (match === null)
    throw new Error(
      "brand mark not found: docs/brand/symbol.svg or brand-mark in presentation/src/shell.html",
    )
  return { viewBox: match[1] ?? "0 0 32 32", body: (match[2] ?? "").trim() }
}

export function readPalette(frontendRoot: string): BrandPalette {
  const sources = readTokenSources(frontendRoot)
  const pick = (theme: ThemeName): ThemePalette => {
    const entries = Object.entries(PALETTE_TOKENS).map(([key, token]) => {
      const color = themeColor(sources, theme, token)
      if (color === null) throw new Error(`token ${token} has no ${theme} value`)
      return [key, color]
    })
    return Object.fromEntries(entries) as unknown as ThemePalette
  }
  return { light: pick("light"), dark: pick("dark") }
}

export const onSurface = (colors: ThemePalette): MarkColors => ({
  base: colors.side,
  accent: colors.fact,
})

export const onTile = (colors: ThemePalette): MarkColors => ({
  base: colors.onTile,
  accent: colors.fact,
})

export const onFact = (colors: ThemePalette): MarkColors => ({
  base: colors.side,
  accent: colors.text,
})

function markStyle(colors: MarkColors, tile?: string): string {
  const background = tile === undefined ? "" : `.mark-tile{fill:${tile}}`
  return `${background}.mark-base{fill:${colors.base}}.mark-accent{fill:${colors.accent}}`
}

function framed(mark: Mark, tile: Tile, filled: boolean): string {
  const [x = 0, y = 0, width = 64, height = 64] = mark.viewBox.split(/[\s,]+/).map(Number)
  const shift = (start: number, length: number): number =>
    Number(((start + length / 2) * (1 - tile.scale)).toFixed(3))
  const rect = !filled
    ? ""
    : `<rect class="mark-tile" x="${x}" y="${y}" width="${width}" height="${height}" rx="${Number((width * tile.radius).toFixed(3))}"/>`
  return `${rect}<g transform="translate(${shift(x, width)} ${shift(y, height)}) scale(${Number(tile.scale.toFixed(4))})">${mark.body}</g>`
}

export function faviconSvg(mark: Mark, palette: BrandPalette): string {
  const light = markStyle(onTile(palette.light), palette.light.tile)
  const dark = markStyle(onTile(palette.dark), palette.dark.tile)
  const style = `${light}@media (prefers-color-scheme:dark){${dark}}`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${mark.viewBox}"><style>${style}</style>${framed(mark, FAVICON_TILE, true)}</svg>\n`
}

export function tileSvg(
  mark: Mark,
  tile: Tile,
  colors: MarkColors,
  background: string | null,
): string {
  const style = markStyle(colors, background ?? undefined)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${mark.viewBox}" width="100%" height="100%"><style>${style}</style>${framed(mark, tile, background !== null)}</svg>`
}

export function paintedMark(mark: Mark, colors: MarkColors): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${mark.viewBox}" width="100%" height="100%"><style>${markStyle(colors)}</style>${mark.body}</svg>`
}

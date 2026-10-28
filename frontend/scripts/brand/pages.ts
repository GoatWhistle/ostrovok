import { OG_SIZE } from "./assets.ts"
import type { ThemePalette } from "./marks.ts"

export interface CardText {
  readonly wordmark: string
  readonly tagline: string
  readonly description: string
}

const escapeHtml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const page = (body: string, fonts: string): string =>
  `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}*{box-sizing:border-box;margin:0;padding:0}body{background:transparent}</style></head><body>${body}</body></html>`

export function svgHtml(svg: string, size: number): string {
  return page(`<div id="asset" style="width:${size}px;height:${size}px">${svg}</div>`, "")
}

function scenePanel(scene: string | undefined, mark: string, unit: number): string {
  if (!scene)
    return `<div style="position:absolute;right:${7 * unit}px;top:50%;width:${30 * unit}px;height:${30 * unit}px;transform:translateY(-50%)">${mark}</div>`
  return `<div style="position:absolute;top:0;right:0;bottom:0;width:${46 * unit}px;background:center/cover no-repeat url('${scene}')"></div>`
}

export function cardHtml(
  mark: string,
  text: CardText,
  colors: ThemePalette,
  fonts: string,
  family: string,
  scene?: string,
): string {
  const unit = OG_SIZE.width / 100
  const copy = scene ? 48 : 58
  const body = `<div id="asset" style="position:relative;display:grid;align-content:space-between;width:${OG_SIZE.width}px;height:${OG_SIZE.height}px;padding:${6 * unit}px;overflow:hidden;container-type:inline-size;background:${colors.surface};color:${colors.text};-webkit-font-smoothing:antialiased">
  ${scenePanel(scene, mark, unit)}
  <span style="position:relative;display:flex;align-items:center;gap:0.3em;font-size:5.2cqi"><span style="width:1.1em;height:1.1em;flex:none">${mark}</span><span style="font-weight:800;line-height:1;letter-spacing:-0.05em">${escapeHtml(text.wordmark)}</span></span>
  <div style="position:relative;display:grid;gap:${2.4 * unit}px;max-width:${copy - 6}%">
    <p style="font-size:${scene ? 6.2 : 7.4}cqi;font-weight:800;line-height:1.02;letter-spacing:-0.045em">${escapeHtml(text.tagline)}</p>
    ${scene ? `<p style="font-size:2.1cqi;font-weight:500;line-height:1.35;opacity:0.72">${escapeHtml(text.description)}</p>` : ""}
  </div>
</div>`
  return page(body, `${fonts}#asset{font-family:${family}}`)
}

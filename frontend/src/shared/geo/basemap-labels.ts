import { layers, namedFlavor } from "@protomaps/basemaps"
import type { LayerSpecification, Map as MapLibreMap } from "maplibre-gl"

export interface BasemapAssets {
  readonly regionId: string
  readonly basemapUrl: string
  readonly glyphsUrl: string
  readonly spriteUrl: string
}

export interface LabelColors {
  readonly label: string
  readonly labelStrong: string
  readonly labelHalo: string
}

const PREFIX = "basemap-"
const SKIPPED = ["pois", "shield"]

function absolute(path: string): string {
  return new URL(path, window.location.origin).href.replaceAll("%7B", "{").replaceAll("%7D", "}")
}

function labelLayers(source: string, lang: string): LayerSpecification[] {
  return layers(source, namedFlavor("black"), { lang, labelsOnly: true })
    .filter((layer) => !SKIPPED.some((part) => layer.id.includes(part)))
    .map((layer) => ({ ...layer, id: `${source}-${layer.id}`, metadata: { lang } }))
}

function labelIds(map: MapLibreMap): string[] {
  return (map.getStyle().layers ?? [])
    .filter((layer) => "source" in layer && String(layer.source).startsWith(PREFIX))
    .map((layer) => layer.id)
}

function dropStale(map: MapLibreMap, lang: string) {
  for (const layer of map.getStyle().layers ?? []) {
    if (!("source" in layer) || !String(layer.source).startsWith(PREFIX)) continue
    const metadata = layer.metadata as { lang?: unknown } | undefined
    if (metadata?.lang !== lang) map.removeLayer(layer.id)
  }
}

function paintLabels(map: MapLibreMap, colors: LabelColors) {
  for (const id of labelIds(map)) {
    if (map.getLayer(id)?.type !== "symbol") continue
    map.setPaintProperty(
      id,
      "text-color",
      id.includes("places") ? colors.labelStrong : colors.label,
    )
    map.setPaintProperty(id, "text-halo-color", colors.labelHalo)
    map.setPaintProperty(id, "text-halo-width", 1.4)
  }
}

export function raiseLabels(map: MapLibreMap) {
  for (const id of labelIds(map)) map.moveLayer(id)
}

export function labelAnchor(map: MapLibreMap): string | undefined {
  return labelIds(map)[0]
}

export function renderBasemapLabels(
  map: MapLibreMap,
  assets: readonly BasemapAssets[],
  colors: LabelColors,
  lang: string,
) {
  const first = assets[0]
  if (!first) return
  if (!map.getGlyphs()) map.setGlyphs(absolute(first.glyphsUrl))
  if (!map.getSprite().length) map.setSprite(absolute(first.spriteUrl))
  dropStale(map, lang)
  for (const asset of assets) {
    const source = `${PREFIX}${asset.regionId}`
    if (!map.getSource(source))
      map.addSource(source, { type: "vector", url: `pmtiles://${absolute(asset.basemapUrl)}` })
    for (const layer of labelLayers(source, lang)) if (!map.getLayer(layer.id)) map.addLayer(layer)
  }
  paintLabels(map, colors)
  raiseLabels(map)
}

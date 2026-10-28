import type { Map as MapLibreMap } from "maplibre-gl"
import { type RefObject, useLayoutEffect, useRef } from "react"
import { paintRoute } from "@/shared/geo/buildings/map-layers"
import { rgb } from "@/shared/geo/roof-mesh/paint"
import type { MapColors } from "@/shared/theme"
import type { ProofState, ReelFrame } from "../playback/reel-frame"
import { along, type Coordinates, HOTEL, ROUTE } from "../shots"
import { paintGround } from "./ground-shapes"
import { paintNoiseRoads } from "./noise-roads"
import { SUNSET_LAYER, SunsetLayer } from "./sunset-layer"

const ROUTE_LAYERS = [
  ["route-line", 1],
  ["route-casing", 0.35],
  ["route-glow", 0.55],
] as const
const LABEL_SHIFT = 4
const PING_OPACITY = 0.45
const PING_SCALE = 2.6
const NOISE_OPACITY = 0.35

export interface ReelAnchors {
  readonly sea: RefObject<HTMLDivElement | null>
  readonly sunset: RefObject<HTMLDivElement | null>
  readonly quiet: RefObject<HTMLDivElement | null>
}

function place(
  map: MapLibreMap,
  element: HTMLElement | null,
  at: Coordinates,
  proof: ProofState,
  pulse: number,
) {
  if (!element) return
  const { x, y } = map.project([at[0], at[1]])
  element.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
  element.style.opacity = String(proof.draw > 0 ? proof.opacity : 0)
  const text = element.querySelector<HTMLElement>("[data-part='text']")
  const ping = element.querySelector<HTMLElement>("[data-part='ping']")
  if (text) {
    text.style.opacity = String(proof.label)
    text.style.transform = `translateY(${((1 - proof.label) * LABEL_SHIFT).toFixed(2)}px)`
  }
  if (ping) {
    ping.style.opacity = String((1 - pulse) * PING_OPACITY * proof.label)
    ping.style.transform = `scale(${(1 + pulse * PING_SCALE).toFixed(3)})`
  }
}

function sunsetWeight(frame: ReelFrame): number {
  const sunset = frame.proofs.sunset
  return Math.min(1, sunset.draw * 1.4) * sunset.opacity
}

const sunsets = new WeakMap<MapLibreMap, SunsetLayer>()

function paintSunset(map: MapLibreMap, colors: MapColors, weight: number) {
  let layer = sunsets.get(map)
  if (!layer || !map.getLayer(SUNSET_LAYER)) {
    layer = new SunsetLayer()
    map.addLayer(layer)
    sunsets.set(map, layer)
  }
  const [r, g, b] = rgb(colors.sunLow)
  layer.update(weight, {
    hot: [r, g * 0.82, b * 0.6],
    warm: [r, g * 0.5, b * 0.3],
    core: [r + (1 - r) * 0.55, g + (1 - g) * 0.45, b + (1 - b) * 0.3],
  })
}

function drawRoute(map: MapLibreMap, colors: MapColors, frame: ReelFrame) {
  const proof = frame.proofs.sea
  paintRoute(map, colors, proof.draw)
  for (const [id, opacity] of ROUTE_LAYERS)
    if (map.getLayer(id)) map.setPaintProperty(id, "line-opacity", opacity * proof.opacity)
}

function paintProofs(map: MapLibreMap, colors: MapColors, frame: ReelFrame, golden: boolean) {
  const { quiet } = frame.proofs
  drawRoute(map, colors, frame)
  paintNoiseRoads(map, colors.routeGlow, quiet.draw * quiet.opacity * NOISE_OPACITY)
  paintGround(map, { calm: quiet.draw, calmFade: quiet.opacity }, colors.hotelSelected)
  paintSunset(map, colors, golden ? sunsetWeight(frame) : 0)
}

export function useReelCamera(
  map: RefObject<MapLibreMap | null>,
  ready: boolean,
  frame: ReelFrame,
  colors: MapColors,
  padding: { readonly top: number; readonly bottom: number },
  golden: boolean,
) {
  const anchors: ReelAnchors = {
    sea: useRef<HTMLDivElement>(null),
    sunset: useRef<HTMLDivElement>(null),
    quiet: useRef<HTMLDivElement>(null),
  }
  const previous = useRef("")
  useLayoutEffect(() => {
    const current = map.current
    if (!ready || !current) return
    const camera = {
      ...frame.camera,
      center: [frame.camera.center[0], frame.camera.center[1]] as [number, number],
      padding: { top: padding.top, bottom: padding.bottom, left: 0, right: 0 },
    }
    const key = JSON.stringify(camera)
    if (key !== previous.current) {
      current.jumpTo(camera)
      previous.current = key
    }
    paintProofs(current, colors, frame, golden)
    const { sea, sunset, quiet } = frame.proofs
    place(current, anchors.sea.current, along(ROUTE, sea.draw), sea, frame.pulse)
    place(current, anchors.sunset.current, HOTEL, sunset, frame.pulse)
    place(current, anchors.quiet.current, HOTEL, quiet, frame.pulse)
  })
  return anchors
}

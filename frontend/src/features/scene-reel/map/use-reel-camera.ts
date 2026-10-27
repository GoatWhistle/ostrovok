import type { Map as MapLibreMap } from "maplibre-gl"
import { type RefObject, useLayoutEffect, useRef } from "react"
import { paintRoute } from "@/shared/geo/map-layers"
import type { MapColors } from "@/shared/theme"
import type { ProofState, ReelFrame } from "../playback/reel-frame"
import {
  along,
  CONE_DEGREES,
  type Coordinates,
  HOTEL,
  offset,
  QUIET_METERS,
  RAY_METERS,
  ROUTE,
  ring,
  SUNSET_AZIMUTH,
} from "../shots"
import { paintNoiseRoads } from "./noise-roads"

const ROUTE_LAYERS = [
  ["route-line", 1],
  ["route-casing", 0.35],
  ["route-glow", 0.55],
] as const
export const RINGS = ["near", "middle", "far"] as const
const RING_COUNT = RINGS.length
const RING_SEGMENTS = 48
const LABEL_ENTER = 0.3
const LABEL_SHIFT = 4
const PING_OPACITY = 0.5
const PING_SCALE = 3

export interface ReelAnchors {
  readonly sea: RefObject<HTMLDivElement | null>
  readonly sunset: RefObject<HTMLDivElement | null>
  readonly quiet: RefObject<HTMLDivElement | null>
  readonly ray: RefObject<SVGGElement | null>
  readonly rings: RefObject<(SVGPathElement | null)[]>
}

function pathOf(map: MapLibreMap, points: readonly Coordinates[]) {
  return points
    .map((point, step) => {
      const { x, y } = map.project([point[0], point[1]])
      return `${step === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(" ")
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
  const appear = Math.min(1, proof.label / LABEL_ENTER)
  const text = element.querySelector<HTMLElement>("[data-part='text']")
  const ping = element.querySelector<HTMLElement>("[data-part='ping']")
  if (text) {
    text.style.opacity = String(appear)
    text.style.transform = `translateY(${((1 - appear) * LABEL_SHIFT).toFixed(2)}px)`
  }
  if (ping) {
    ping.style.opacity = String((1 - pulse) * PING_OPACITY)
    ping.style.transform = `scale(${(1 + pulse * PING_SCALE).toFixed(3)})`
  }
}

function drawRoute(map: MapLibreMap, colors: MapColors, frame: ReelFrame) {
  const proof = frame.proofs.sea
  paintRoute(map, colors, proof.draw)
  for (const [id, opacity] of ROUTE_LAYERS)
    if (map.getLayer(id)) map.setPaintProperty(id, "line-opacity", opacity * proof.opacity)
}

function drawRay(map: MapLibreMap, anchors: ReelAnchors, frame: ReelFrame) {
  const meters = Math.max(1, RAY_METERS * frame.proofs.sunset.draw)
  const end = offset(HOTEL, SUNSET_AZIMUTH, meters)
  const group = anchors.ray.current
  if (!group) return end
  const [cone, ray] = group.querySelectorAll("path")
  cone?.setAttribute(
    "d",
    `${pathOf(map, [
      HOTEL,
      offset(HOTEL, SUNSET_AZIMUTH - CONE_DEGREES, meters),
      offset(HOTEL, SUNSET_AZIMUTH + CONE_DEGREES, meters),
    ])} Z`,
  )
  ray?.setAttribute("d", pathOf(map, [HOTEL, end]))
  const { x, y } = map.project([end[0], end[1]])
  for (const circle of group.querySelectorAll("circle")) {
    circle.setAttribute("cx", x.toFixed(1))
    circle.setAttribute("cy", y.toFixed(1))
  }
  return end
}

function drawRings(map: MapLibreMap, anchors: ReelAnchors, frame: ReelFrame) {
  const rings = anchors.rings.current
  for (let step = 0; step < RING_COUNT; step += 1) {
    const element = rings[step]
    if (!element) continue
    const phase = (frame.pulse + step / RING_COUNT) % 1
    const meters = QUIET_METERS * (0.35 + 0.65 * phase) * Math.max(0.2, frame.proofs.quiet.draw)
    element.setAttribute("d", `${pathOf(map, ring(HOTEL, meters, RING_SEGMENTS))} Z`)
    element.style.opacity = String((1 - phase) * frame.proofs.quiet.opacity)
  }
}

export function useReelCamera(
  map: RefObject<MapLibreMap | null>,
  ready: boolean,
  frame: ReelFrame,
  colors: MapColors,
  padding: { readonly top: number; readonly bottom: number },
) {
  const anchors: ReelAnchors = {
    sea: useRef<HTMLDivElement>(null),
    sunset: useRef<HTMLDivElement>(null),
    quiet: useRef<HTMLDivElement>(null),
    ray: useRef<SVGGElement>(null),
    rings: useRef<(SVGPathElement | null)[]>([]),
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
    const quiet = frame.proofs.quiet
    drawRoute(current, colors, frame)
    drawRings(current, anchors, frame)
    paintNoiseRoads(current, colors.routeGlow, quiet.draw * quiet.opacity * (1 - 0.5 * quiet.label))
    const { sea, sunset } = frame.proofs
    place(current, anchors.sea.current, along(ROUTE, sea.draw), sea, frame.pulse)
    place(current, anchors.sunset.current, drawRay(current, anchors, frame), sunset, frame.pulse)
    place(current, anchors.quiet.current, HOTEL, quiet, frame.pulse)
  })
  return anchors
}

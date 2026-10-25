import { Map as MapLibreMap, Marker } from "maplibre-gl"
import { useEffect, useRef, useState } from "react"
import { renderBasemap } from "@/shared/geo/basemap"
import { lightMode, renderTerrain, type SunPosition } from "@/shared/geo/terrain"
import { tintForTime } from "@/shared/geo/time-tint"
import { motionMs, useReducedMotion } from "@/shared/motion"
import { type MapColors, useMapColors } from "@/shared/theme"
import { prefetchShot } from "./prefetch"
import { cameraOptions, SHOTS, type Shot } from "./shots"

const ROAD_LAYERS = ["base-roads-casing", "base-roads"] as const
const ROAD_MIN_ZOOM = 14
const MAX_PIXEL_RATIO = 1.5

const EMPTY_STYLE = {
  version: 8 as const,
  sources: {},
  layers: [],
  transition: { duration: 0, delay: 0 },
}

function useReelMap() {
  const container = useRef<HTMLDivElement>(null)
  const instance = useRef<MapLibreMap | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const element = container.current
    if (!element) return
    let map: MapLibreMap
    try {
      map = new MapLibreMap({
        container: element,
        style: EMPTY_STYLE,
        interactive: false,
        attributionControl: false,
        maxPitch: 80,
        fadeDuration: 0,
        pixelRatio: Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO),
        ...cameraOptions(
          SHOTS[0]?.from ?? { center: [39.72, 43.58], zoom: 14, pitch: 60, bearing: 0 },
        ),
      })
    } catch {
      setFailed(true)
      return
    }
    instance.current = map
    const loaded = () => setReady(true)
    const lost = () => setFailed(true)
    map.on("load", loaded)
    map.on("webglcontextlost", lost)
    const resize = new ResizeObserver(() => map.resize())
    resize.observe(element)
    return () => {
      resize.disconnect()
      map.off("load", loaded)
      map.off("webglcontextlost", lost)
      map.remove()
      instance.current = null
      setReady(false)
    }
  }, [])
  return { container, instance, ready, failed }
}

function paintScene(map: MapLibreMap, colors: MapColors, sun: SunPosition) {
  if (!map.getLayer("canvas"))
    map.addLayer({ id: "canvas", type: "background", paint: { "background-color": colors.sea } })
  const scene = tintForTime(colors, lightMode(sun.altitude))
  renderTerrain(map, scene, sun)
  renderBasemap(map, scene)
  for (const layer of ROAD_LAYERS) map.setLayerZoomRange(layer, ROAD_MIN_ZOOM, 24)
}

function dropPins(map: MapLibreMap, shot: Shot, className: string): Marker[] {
  return shot.pins.map((position, step) => {
    const element = document.createElement("span")
    const dot = document.createElement("span")
    dot.className = className
    dot.style.setProperty("--pin-step", String(step))
    element.append(dot)
    element.setAttribute("aria-hidden", "true")
    return new Marker({ element, anchor: "bottom" })
      .setLngLat([position[0], position[1]])
      .addTo(map)
  })
}

export function useSceneReel(pinClass: string) {
  const { container, instance, ready, failed } = useReelMap()
  const colors = useMapColors()
  const reduced = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [shown, setShown] = useState(false)
  const palette = useRef(colors)
  const sun = useRef<SunPosition>(SHOTS[0]?.sun ?? { azimuth: 200, altitude: 30 })
  useEffect(() => {
    palette.current = colors
    const map = instance.current
    if (ready && map) paintScene(map, colors, sun.current)
  }, [instance, ready, colors])
  useEffect(() => {
    const map = instance.current
    const shot = SHOTS[index]
    if (!ready || !map || !shot) return
    const life = motionMs("--reel-life")
    const fade = motionMs("--dur-reveal")
    let markers: Marker[] = []
    let next = 0
    let fallback = 0
    const reveal = () => {
      window.clearTimeout(fallback)
      map.off("idle", reveal)
      setShown(true)
      markers = dropPins(map, shot, pinClass)
      if (!reduced)
        map.easeTo({ ...cameraOptions(shot.to), duration: life + fade, easing: (t) => t })
      next = window.setTimeout(() => setIndex((current) => (current + 1) % SHOTS.length), life)
    }
    const upcoming = SHOTS[(index + 1) % SHOTS.length]
    if (upcoming) prefetchShot(upcoming)
    setShown(false)
    const start = window.setTimeout(
      () => {
        map.stop()
        sun.current = shot.sun
        paintScene(map, palette.current, shot.sun)
        map.jumpTo(cameraOptions(shot.from))
        map.once("idle", reveal)
        fallback = window.setTimeout(reveal, fade * 4)
      },
      index === 0 && !map.isMoving() ? 0 : fade,
    )
    return () => {
      window.clearTimeout(start)
      window.clearTimeout(next)
      window.clearTimeout(fallback)
      map.off("idle", reveal)
      const leaving = markers
      window.setTimeout(() => {
        for (const marker of leaving) marker.remove()
      }, fade)
    }
  }, [instance, ready, index, reduced, pinClass])
  return { container, failed, index, shown, ready }
}

import { Map as MapLibreMap } from "maplibre-gl"
import { useEffect, useRef, useState } from "react"
import { renderBasemap } from "@/shared/geo/basemap"
import { animateSurf, renderSurf } from "@/shared/geo/surf"
import { lightMode, renderTerrain, type SunPosition, scenePalette } from "@/shared/geo/terrain"
import { tintForTime } from "@/shared/geo/time-tint"
import { motionMs, useReducedMotion } from "@/shared/motion"
import { type MapColors, useMapColors } from "@/shared/theme"
import { prefetchShot } from "./prefetch"
import { placeMarks, type ReelMark } from "./reel-marks"
import { cameraOptions, SHOTS } from "./shots"

const ROAD_LAYERS = ["base-roads-casing", "base-roads"] as const
const ROAD_MIN_ZOOM = 14
const MAX_PIXEL_RATIO = 1.5
const TOP_PADDING = 0.28
const REVEAL_WAIT = 12

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
    const resize = new ResizeObserver(() => {
      map.resize()
      map.setPadding({ top: element.clientHeight * TOP_PADDING, right: 0, bottom: 0, left: 0 })
    })
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
  const mode = lightMode(sun.altitude)
  const scene = tintForTime(colors, mode)
  renderTerrain(map, scene, sun)
  renderBasemap(map, scene)
  renderSurf(map, scene.hillHighlight)
  for (const layer of ROAD_LAYERS) map.setLayerZoomRange(layer, ROAD_MIN_ZOOM, 24)
  const { sky, horizon } = scenePalette(colors, mode)
  map.setPaintProperty("canvas", "background-color", horizon)
  map.setSky({
    "sky-color": sky,
    "horizon-color": horizon,
    "fog-color": horizon,
    "sky-horizon-blend": 0.6,
    "horizon-fog-blend": 0.9,
    "fog-ground-blend": 0.35,
  })
}

export function useSceneReel() {
  const { container, instance, ready, failed } = useReelMap()
  const colors = useMapColors()
  const reduced = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [shown, setShown] = useState(false)
  const [marks, setMarks] = useState<readonly ReelMark[]>([])
  const palette = useRef(colors)
  const sun = useRef<SunPosition>(SHOTS[0]?.sun ?? { azimuth: 200, altitude: 30 })
  useEffect(() => {
    palette.current = colors
    const map = instance.current
    if (ready && map) paintScene(map, colors, sun.current)
  }, [instance, ready, colors])
  useEffect(() => {
    const map = instance.current
    if (!ready || !map || reduced) return
    return animateSurf(map, motionMs("--dur-press"))
  }, [instance, ready, reduced])
  useEffect(() => {
    const map = instance.current
    const shot = SHOTS[index]
    if (!ready || !map || !shot) return
    const life = motionMs("--reel-life")
    const fade = motionMs("--dur-reveal")
    let placed: ReelMark[] = []
    let next = 0
    let fallback = 0
    let cancelPrefetch: (() => void) | undefined
    const reveal = () => {
      window.clearTimeout(fallback)
      map.off("idle", reveal)
      setShown(true)
      const upcoming = SHOTS[(index + 1) % SHOTS.length]
      if (upcoming) cancelPrefetch = prefetchShot(upcoming)
      placed = placeMarks(map, shot)
      setMarks((current) => [...current, ...placed])
      if (!reduced)
        map.easeTo({ ...cameraOptions(shot.to), duration: life + fade, easing: (t) => t })
      next = window.setTimeout(() => setIndex((current) => (current + 1) % SHOTS.length), life)
    }
    setShown(false)
    const start = window.setTimeout(
      () => {
        map.stop()
        sun.current = shot.sun
        paintScene(map, palette.current, shot.sun)
        map.jumpTo(cameraOptions(shot.from))
        map.once("idle", reveal)
        fallback = window.setTimeout(reveal, fade * REVEAL_WAIT)
      },
      index === 0 && !map.isMoving() ? 0 : fade,
    )
    return () => {
      cancelPrefetch?.()
      window.clearTimeout(start)
      window.clearTimeout(next)
      window.clearTimeout(fallback)
      map.off("idle", reveal)
      const leaving = placed
      window.setTimeout(() => {
        for (const mark of leaving) mark.marker.remove()
        setMarks((current) => current.filter((mark) => !leaving.includes(mark)))
      }, fade)
    }
  }, [instance, ready, index, reduced])
  return { container, failed, index, shown, ready, marks }
}

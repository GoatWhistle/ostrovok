import type { Map as MapLibreMap } from "maplibre-gl"
import { renderBasemap } from "../basemap/basemap"
import { type BasemapAssets, outside, renderBasemapLabels } from "../basemap/basemap-labels"
import { type CatalogClass, renderCatalogLayers } from "../basemap/catalog-layers"
import { mixHex } from "../color/hex-color"
import { renderShore } from "../ground/shore-layers"
import { nightFactor } from "../night-city/night-layers"
import { type NightLight, sunLight } from "../sun/sun-light"
import {
  renderTerrain,
  type SunPosition,
  scenePalette,
  type TerrainColors,
} from "../terrain/terrain"
import { renderPlaceLabels } from "../world/place-labels"
import { labelPalette, nightLabelPalette } from "./label-palette"
import { paintMeshes } from "./mesh-paint"
import { applyMiniProfile } from "./mini-profile"
import { APPEARANCES } from "./packages"
import { appearanceClasses, readAppearanceColors, readNightColors, tintedColors } from "./palette"
import type { MapAppearance } from "./types"

const OVERVIEW_ALTITUDE = 45
const SHALLOW_SAND = 0.38
const FOAM_WHITE = 0.72
const PIER_SAND = 0.3
const HILLSHADE = "sochi-hillshade"
const controllers = new WeakMap<MapLibreMap, MapAppearanceController>()

export function previewMapSun(map: MapLibreMap | null, sun: SunPosition | undefined) {
  if (map) controllers.get(map)?.previewSun(sun)
}

export interface MapSceneSnapshot {
  readonly catalog: readonly CatalogClass[]
  readonly assets: readonly BasemapAssets[]
  readonly locale: string
  readonly sun: SunPosition
  readonly excluded: readonly string[]
}

export class MapAppearanceController {
  private appearance: MapAppearance = "neon"
  private scene: MapSceneSnapshot | undefined
  private visible = true
  private disposed = false
  private preview: SunPosition | undefined
  private light: { colors: TerrainColors; contrast: number } | undefined
  private readonly map: MapLibreMap
  private readonly profile: "main" | "mini"

  constructor(map: MapLibreMap, profile: "main" | "mini" = "main") {
    this.map = map
    this.profile = profile
    if (profile === "main") controllers.set(map, this)
    map.on("styledata", this.refreshRoofs)
  }

  applyAppearance(id: MapAppearance) {
    if (this.disposed) return
    const previous = this.appearance
    this.appearance = id
    try {
      this.paint()
    } catch (error) {
      this.appearance = previous
      this.paint()
      throw error
    }
  }

  updateScene(scene: MapSceneSnapshot) {
    if (this.disposed) return
    this.scene = scene
    this.preview = undefined
    this.paint()
  }

  setVisible(visible: boolean) {
    if (this.disposed || this.visible === visible) return
    this.visible = visible
    if (visible) this.paint()
    else this.map.stop()
  }

  dispose() {
    this.disposed = true
    if (controllers.get(this.map) === this) controllers.delete(this.map)
    this.map.off("styledata", this.refreshRoofs)
    this.scene = undefined
  }

  previewSun(sun: SunPosition | undefined) {
    if (this.disposed) return
    this.preview = sun
    if (!this.visible || !this.scene) return
    this.paintLight()
    this.refreshRoofs()
  }

  private paintLight() {
    const sun = this.preview ?? this.scene?.sun
    const light = this.light
    if (!sun || !light) return
    this.map.setLight({
      anchor: "map",
      ...sunLight(light.colors, sun.azimuth, sun.altitude, light.contrast, this.nightLight(sun)),
    })
    if (this.map.getLayer(HILLSHADE))
      this.map.setPaintProperty(HILLSHADE, "hillshade-illumination-direction", sun.azimuth)
  }

  private nightLight(sun: SunPosition): NightLight | undefined {
    return APPEARANCES[this.appearance].night ? { moon: sun.moon } : undefined
  }

  private refreshRoofs = () => {
    if (this.disposed || !this.visible || this.profile === "mini") return
    const sun = this.scene?.sun ?? { azimuth: 0, altitude: OVERVIEW_ALTITUDE }
    paintMeshes(this.map, this.appearance, this.preview ?? sun, sun.altitude)
  }

  private paint() {
    const scene = this.scene
    const map = this.map
    if (!scene || !this.visible) return
    const colors = readAppearanceColors(this.appearance)
    const night = readNightColors(this.appearance)
    const { materials } = APPEARANCES[this.appearance]
    const altitude = scene.sun.altitude
    const keyed = APPEARANCES[this.appearance].night !== undefined
    const tinted = tintedColors(this.appearance, colors, night, altitude)
    const base = keyed ? colors : tinted
    const classes = appearanceClasses(this.appearance, scene.catalog, base, night, altitude)
    if (!map.getLayer("canvas"))
      map.addLayer({ id: "canvas", type: "background", paint: { "background-color": tinted.sea } })
    this.light = { colors: tinted, contrast: materials.lightContrast }
    renderTerrain(map, tinted, scene.sun, materials.lightContrast, this.nightLight(scene.sun))
    if (this.preview) this.paintLight()
    const sea = scenePalette(tinted, scene.sun.altitude).sea
    map.getContainer().parentElement?.style.setProperty("--map-backdrop", sea)
    renderBasemap(map, tinted, keyed ? nightFactor(altitude) : 0)
    renderCatalogLayers(map, classes, scene.excluded, sea)
    renderShore(map, {
      shallows: mixHex(sea, tinted.sand, SHALLOW_SAND),
      foam: mixHex(sea, tinted.road, FOAM_WHITE),
      pier: mixHex(tinted.building, tinted.sand, PIER_SAND),
    })
    const labels = keyed
      ? nightLabelPalette(colors, { ...colors, ...night }, altitude)
      : labelPalette(colors, tinted, altitude)
    renderBasemapLabels(map, scene.assets, labels, scene.locale)
    renderPlaceLabels(map, labels, scene.locale, outside(scene.assets.map((asset) => asset.bbox)))
    this.refreshRoofs()
    if (this.profile === "mini") applyMiniProfile(map, APPEARANCES[this.appearance])
    for (const id of ["overview-volumes", "scene-volumes", "buildings-volume"]) {
      if (map.getLayer(id))
        map.setPaintProperty(id, "fill-extrusion-vertical-gradient", materials.verticalGradient)
    }
  }
}

import type { Map as MapLibreMap } from "maplibre-gl"
import { renderBasemap } from "../basemap"
import { type BasemapAssets, renderBasemapLabels } from "../basemap-labels"
import { type CatalogClass, renderCatalogLayers } from "../catalog-layers"
import { lightMode, renderTerrain, type SunPosition, scenePalette } from "../terrain"
import { tintForTime } from "../time-tint"
import { APPEARANCES } from "./packages"
import { appearanceClasses, readAppearanceColors } from "./palette"
import type { MapAppearance } from "./types"

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
  private readonly map: MapLibreMap

  constructor(map: MapLibreMap) {
    this.map = map
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
    this.scene = undefined
  }

  private paint() {
    const scene = this.scene
    const map = this.map
    if (!scene || !this.visible) return
    const colors = readAppearanceColors(this.appearance)
    const classes = appearanceClasses(this.appearance, scene.catalog, colors)
    if (!map.getLayer("canvas"))
      map.addLayer({ id: "canvas", type: "background", paint: { "background-color": colors.sea } })
    const mode = lightMode(scene.sun.altitude)
    const tinted = tintForTime(colors, mode)
    renderTerrain(map, tinted, scene.sun)
    map
      .getContainer()
      .parentElement?.style.setProperty("--map-backdrop", scenePalette(tinted, mode).sea)
    renderBasemap(map, tinted)
    renderCatalogLayers(map, classes, scene.excluded)
    renderBasemapLabels(map, scene.assets, colors, scene.locale)
    const materials = APPEARANCES[this.appearance].materials
    for (const id of ["overview-volumes", "scene-volumes", "buildings-volume"]) {
      if (map.getLayer(id))
        map.setPaintProperty(id, "fill-extrusion-vertical-gradient", materials.verticalGradient)
    }
  }
}

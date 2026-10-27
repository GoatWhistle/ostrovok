import type { Map as MapLibreMap } from "maplibre-gl"
import { renderBasemap } from "../basemap"
import { type BasemapAssets, renderBasemapLabels } from "../basemap-labels"
import { type CatalogClass, renderCatalogLayers } from "../catalog-layers"
import { lightMode, renderTerrain, type SunPosition, scenePalette } from "../terrain"
import { tintForTime } from "../time-tint"
import { applyMiniProfile } from "./mini-profile"
import { APPEARANCES } from "./packages"
import { appearanceClasses, readAppearanceColors } from "./palette"
import { renderAppearanceRoofs, roofPaint } from "./roofs"
import { renderGroundShadows } from "./shadows"
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
  private readonly profile: "main" | "mini"

  constructor(map: MapLibreMap, profile: "main" | "mini" = "main") {
    this.map = map
    this.profile = profile
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
    this.map.off("styledata", this.refreshRoofs)
    this.scene = undefined
  }

  private refreshRoofs = () => {
    if (this.disposed || !this.visible || this.profile === "mini") return
    const materials = APPEARANCES[this.appearance].materials
    const tokens = materials.roofTokens ?? (materials.roofToken ? [materials.roofToken] : [])
    const style = getComputedStyle(document.documentElement)
    const colors = tokens
      .map((token) => style.getPropertyValue(token).trim())
      .filter((value) => value.length > 0)
    renderAppearanceRoofs(this.map, roofPaint(colors))
    const sun = this.scene?.sun
    renderGroundShadows(
      this.map,
      materials.shadowToken ? style.getPropertyValue(materials.shadowToken).trim() : undefined,
      sun?.azimuth ?? 0,
      sun?.altitude ?? 0,
    )
  }

  private paint() {
    const scene = this.scene
    const map = this.map
    if (!scene || !this.visible) return
    const colors = readAppearanceColors(this.appearance)
    const mode = lightMode(scene.sun.altitude)
    const tinted = tintForTime(colors, mode, scene.sun.altitude)
    const classes = appearanceClasses(this.appearance, scene.catalog, tinted)
    if (!map.getLayer("canvas"))
      map.addLayer({ id: "canvas", type: "background", paint: { "background-color": tinted.sea } })
    renderTerrain(map, tinted, scene.sun)
    map
      .getContainer()
      .parentElement?.style.setProperty("--map-backdrop", scenePalette(tinted, mode).sea)
    renderBasemap(map, tinted)
    renderCatalogLayers(map, classes, scene.excluded)
    renderBasemapLabels(map, scene.assets, colors, scene.locale)
    this.refreshRoofs()
    if (this.profile === "mini") applyMiniProfile(map, APPEARANCES[this.appearance])
    const materials = APPEARANCES[this.appearance].materials
    for (const id of ["overview-volumes", "scene-volumes", "buildings-volume"]) {
      if (map.getLayer(id))
        map.setPaintProperty(id, "fill-extrusion-vertical-gradient", materials.verticalGradient)
    }
  }
}

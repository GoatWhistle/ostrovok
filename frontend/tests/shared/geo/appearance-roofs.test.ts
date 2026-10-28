import type { Map as MapLibreMap } from "maplibre-gl"
import { expect, it, vi } from "vitest"
import { renderAppearanceRoofs } from "@/shared/geo/appearance/roofs"
import { overviewHeight } from "@/shared/geo/buildings/overview-buildings"

function scene() {
  const layers = new Map<string, { id: string; filter?: unknown; paint: Record<string, unknown> }>([
    [
      "overview-volumes",
      {
        id: "overview-volumes",
        filter: [">", ["get", "height_m"], 0],
        paint: { "fill-extrusion-height": ["get", "height_m"] },
      },
    ],
  ])
  const map = {
    getSource: (id: string) => id === "sochi-map",
    getLayer: (id: string) => layers.get(id),
    getStyle: () => ({ layers: [...layers.values()] }),
    getFilter: (id: string) => layers.get(id)?.filter,
    getPaintProperty: (id: string, key: string) => layers.get(id)?.paint[key],
    addLayer: vi.fn((layer) => layers.set(layer.id, layer)),
    removeLayer: vi.fn((id: string) => layers.delete(id)),
    setFilter: vi.fn((id: string, filter: unknown) => {
      const layer = layers.get(id)
      if (layer) layer.filter = filter
    }),
    setPaintProperty: vi.fn((id: string, key: string, value: unknown) => {
      const layer = layers.get(id)
      if (layer) layer.paint[key] = value
    }),
  }
  return { layers, map, instance: map as unknown as MapLibreMap }
}

it("keeps roof caps on the same real buildings and follows the owner's exclusion filter", () => {
  const { layers, map, instance } = scene()
  renderAppearanceRoofs(instance, "#b46b55")
  const roof = layers.get("toy-overview-roofs")
  expect(roof?.filter).toEqual([">", ["get", "height_m"], 0])
  expect(roof?.paint["fill-extrusion-base"]).toEqual(overviewHeight())
  expect(roof?.paint["fill-extrusion-height"]).toEqual(overviewHeight(0.25))
  const filter = ["all", [">", ["get", "height_m"], 0], ["!=", ["get", "id"], "selected-hotel"]]
  map.setFilter("overview-volumes", filter)
  renderAppearanceRoofs(instance, "#b46b55")
  expect(roof?.filter).toEqual(filter)
  expect(map.addLayer).toHaveBeenCalledTimes(1)
})

it("removes only package-owned roofs when returning to neon", () => {
  const { layers, instance } = scene()
  renderAppearanceRoofs(instance, "#b46b55")
  renderAppearanceRoofs(instance, undefined)
  expect([...layers.keys()]).toEqual(["overview-volumes"])
})

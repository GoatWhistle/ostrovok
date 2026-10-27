import type { Map as MapLibreMap } from "maplibre-gl"
import type { RefObject } from "react"
import { type MessageKey, useTranslation } from "@/shared/i18n"
import { MapAttribution } from "@/shared/ui"
import { MapLegendToggle } from "../map-legend"
import { MapScale } from "../map-scale"
import styles from "./map-meta.module.css"

export function MapMeta({
  map,
  ready,
  notes,
}: {
  readonly map: RefObject<MapLibreMap | null>
  readonly ready: boolean
  readonly notes: readonly MessageKey[]
}) {
  const { t } = useTranslation()
  return (
    <div className={styles.meta} data-map-obstacle>
      <MapScale map={map} ready={ready} />
      <MapLegendToggle notes={notes} />
      <MapAttribution
        label={t("explore:map.attributionTitle")}
        osm={t("explore:map.attribution")}
        terrain={t("explore:map.terrainAttribution")}
        sources={{
          weather: t("explore:map.weatherAttribution"),
          landcover: t("explore:map.landcoverAttribution"),
          biodiversity: t("explore:map.biodiversityAttribution"),
          events: t("explore:map.eventsAttribution"),
          license: t("explore:map.dataLicense"),
        }}
      />
    </div>
  )
}

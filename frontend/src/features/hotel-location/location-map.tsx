import { useEffect, useRef, useState } from "react"
import { useHotelGeometry } from "@/entities/hotel"
import type { HotelSummary } from "@/shared/api/hotel-types"
import { useTranslation } from "@/shared/i18n"
import { Banner, Button, EmptyState, Icon, MapAttribution, MapScale, Skeleton } from "@/shared/ui"
import styles from "./location-map.module.css"
import { useLocationMap } from "./use-location-map"

export function LocationMap({
  hotel,
  point,
  geoRefs,
}: {
  readonly hotel: HotelSummary
  readonly point: [number, number]
  readonly geoRefs: readonly string[]
}) {
  const { t } = useTranslation()
  const geometry = useHotelGeometry(geoRefs, hotel)
  const marker = useRef<HTMLSpanElement>(null)
  const map = useLocationMap(point, geometry.data?.features ?? [], marker)
  const [painted, setPainted] = useState(false)
  useEffect(() => {
    const instance = map.instance.current
    if (!map.ready || !instance) return
    instance.getCanvas().tabIndex = -1
    if (instance.loaded() && instance.areTilesLoaded()) {
      setPainted(true)
      return
    }
    const done = () => setPainted(true)
    instance.once("idle", done)
    return () => {
      instance.off("idle", done)
    }
  }, [map.instance, map.ready])
  return (
    <div className={styles.map} data-minimap-active={map.active}>
      <div ref={map.container} className={styles.canvas} />
      <span
        ref={marker}
        className={styles.marker}
        role="img"
        aria-label={hotel.name}
        data-minimap-hotel={hotel.id}
      >
        <Icon name="pin" />
      </span>
      {map.failed ? (
        <div className={styles.state}>
          <EmptyState
            icon="map"
            title={t("explore:location.unavailable")}
            description={t("explore:location.unavailableText")}
          />
        </div>
      ) : !map.ready || !painted ? (
        <div className={styles.state}>
          <Skeleton shape="block" />
        </div>
      ) : null}
      {geometry.isError ? (
        <div className={styles.notice}>
          <Banner tone="warning" title={t("explore:location.geometryError")}>
            <Button
              size="compact"
              variant="ghost"
              icon="retry"
              onClick={() => void geometry.refetch()}
            >
              {t("common:action.retry")}
            </Button>
          </Banner>
        </div>
      ) : null}
      <div className={styles.meta}>
        <MapScale map={map.instance} ready={map.active} />
        <MapAttribution
          label={t("explore:map.attributionTitle")}
          osm={t("explore:map.attribution")}
          terrain={t("explore:map.terrainAttribution")}
        />
      </div>
    </div>
  )
}

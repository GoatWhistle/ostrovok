import { useRegions } from "@/entities/catalog"
import { useGeoFeatures, useHotelScene } from "@/entities/hotel"
import type { Camera } from "@/shared/api/hotel-types"
import { useTranslation } from "@/shared/i18n"
import { Button, EmptyState, ErrorState, Icon } from "@/shared/ui"
import styles from "./hotel-map.module.css"
import { sceneData, sceneQuality } from "./scene-data"
import { useHotelMap } from "./use-hotel-map"
export interface HotelMapProps {
  readonly hotelId: string | undefined
  readonly camera: Camera | undefined
  readonly geoRefs: readonly string[]
  readonly regionId: string | undefined
}
export function HotelMap({ hotelId, camera, geoRefs, regionId }: HotelMapProps) {
  const { t } = useTranslation()
  const scene = useHotelScene(hotelId)
  const regions = useRegions()
  const geometry = useGeoFeatures(geoRefs)
  const region =
    regions.data?.items?.find((item) => item.id === regionId) ?? regions.data?.items?.[0]
  const { selectedCamera, buildings, highlights } = sceneData(
    scene.data,
    camera,
    region?.default_camera,
    geometry.data,
  )
  const { invalid, missingHeight } = sceneQuality(buildings, highlights)
  const map = useHotelMap({ camera: selectedCamera, buildings, highlights })
  return (
    <section className={styles.stage} aria-label={t("explore:map.title")}>
      <div className={styles.caption}>
        <Icon name="layers" size="sm" />
        <span>{t("explore:map.layer")}</span>
      </div>
      <section ref={map.container} className={styles.canvas} aria-label={t("explore:map.canvas")} />
      {!selectedCamera && !scene.isError ? (
        <div className={styles.empty}>
          <EmptyState
            icon="map"
            title={t("explore:map.empty")}
            description={t("explore:map.emptyText")}
          />
        </div>
      ) : null}
      {scene.isError ? (
        <div className={styles.empty}>
          <ErrorState title={t("explore:map.error")} onRetry={() => void scene.refetch()} />
        </div>
      ) : null}
      {map.failed ? (
        <div className={styles.empty}>
          <EmptyState
            icon="map"
            title={t("explore:map.unsupported")}
            description={t("explore:map.unsupportedText")}
          />
        </div>
      ) : null}
      <div className={styles.controls}>
        <Button
          variant="secondary"
          icon="zoom-in"
          disabled={!selectedCamera || map.failed}
          aria-label={t("explore:map.zoomIn")}
          onClick={() => map.instance.current?.zoomIn()}
        >
          {t("explore:map.zoomIn")}
        </Button>
        <Button
          variant="secondary"
          icon="zoom-out"
          disabled={!selectedCamera || map.failed}
          onClick={() => map.instance.current?.zoomOut()}
        >
          {t("explore:map.zoomOut")}
        </Button>
        <Button
          variant="secondary"
          icon="locate"
          disabled={!selectedCamera || map.failed}
          onClick={() => {
            if (selectedCamera)
              map.instance.current?.jumpTo({
                center: [selectedCamera.center[0] ?? 0, selectedCamera.center[1] ?? 0],
                zoom: selectedCamera.zoom,
                bearing: selectedCamera.bearing,
                pitch: selectedCamera.pitch,
              })
          }}
        >
          {t("explore:map.overview")}
        </Button>
      </div>
      {invalid || missingHeight ? (
        <p className={styles.warnings}>
          {invalid ? t("explore:map.geodataInvalid") : t("explore:map.noHeight")}
        </p>
      ) : null}
      {buildings.length > 0 ? (
        <a
          className={styles.attribution}
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          {t("explore:map.attribution")}
        </a>
      ) : null}
      {geometry.isError ? (
        <div className={styles.notice}>
          <ErrorState
            title={t("explore:map.geometryError")}
            onRetry={() => void geometry.refetch()}
          />
        </div>
      ) : null}
    </section>
  )
}

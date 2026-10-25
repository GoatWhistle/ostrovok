import { useMemo, useState } from "react"
import { useRegions } from "@/entities/catalog"
import { useGeoFeatures, useHotelScene } from "@/entities/hotel"
import type { Camera, FactBrief, MatchedProperty, SearchResult } from "@/shared/api/hotel-types"
import { factLabel, matchedExplanation, matchedTitle } from "@/shared/geo/fact-label"
import type { Locale } from "@/shared/i18n"
import { useLocale, useTranslation } from "@/shared/i18n"
import { EmptyState, ErrorState, Icon } from "@/shared/ui"
import styles from "./hotel-map.module.css"
import { sceneData, sceneQuality } from "./scene-data"
import { forecastEnd, sceneToday, sunScene } from "./scene-time"
import { SceneTimePanel } from "./scene-time-panel"
import { useHotelMap } from "./use-hotel-map"
import { useWeather } from "./use-weather"
export interface HotelMapProps {
  readonly hotelId: string | undefined
  readonly camera: Camera | undefined
  readonly geoRefs: readonly string[]
  readonly focusedFact: FactBrief | undefined
  readonly focusProperty: MatchedProperty | undefined
  readonly regionId: string | undefined
  readonly results: readonly SearchResult[]
  readonly bounds: readonly number[] | undefined
  readonly onSelect: (result: SearchResult) => void
}

function focusCopy(
  property: MatchedProperty | undefined,
  fact: FactBrief | undefined,
  hasFeatures: boolean,
  locale: Locale,
) {
  if (property)
    return {
      label: matchedTitle(property, locale),
      explanation: matchedExplanation(property, locale),
    }
  if (fact && hasFeatures) return { label: factLabel(fact, locale), explanation: undefined }
  return { label: undefined, explanation: undefined }
}

function sceneLocation(result: SearchResult | undefined, camera: Camera | undefined) {
  return [
    result?.hotel.location[0] ?? camera?.center[0] ?? 39.72,
    result?.hotel.location[1] ?? camera?.center[1] ?? 43.59,
  ] as const
}

export function HotelMap({
  hotelId,
  camera,
  geoRefs,
  focusedFact,
  focusProperty,
  regionId,
  results,
  bounds,
  onSelect,
}: HotelMapProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const [today] = useState(sceneToday)
  const [date, setDate] = useState(today)
  const [hour, setHour] = useState(16)
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
    results,
  )
  const hotel = results.find((item) => item.hotel.id === hotelId)
  const [lon, lat] = sceneLocation(hotel, selectedCamera)
  const sun = useMemo(() => sunScene(date, hour, lat, lon), [date, hour, lat, lon])
  const weather = useWeather(lon, lat, date, hour, selectedCamera !== undefined)
  const { invalid, missingHeight } = sceneQuality(buildings, highlights)
  const focusFeatures = geoRefs.length ? (geometry.data?.features ?? []) : []
  const focus = focusCopy(focusProperty, focusedFact, focusFeatures.length > 0, locale)
  const map = useHotelMap({
    camera: selectedCamera,
    buildings,
    highlights,
    bounds,
    results,
    hotelId,
    onSelect,
    focusFeatures,
    focusLabel: focus.label,
    sun: sun.position,
  })
  return (
    <section className={styles.stage} aria-label={t("explore:map.title")}>
      <div className={styles.caption}>
        <Icon name="layers" size="sm" />
        <span>{t("explore:map.layer")}</span>
      </div>
      <section ref={map.container} className={styles.canvas} aria-label={t("explore:map.canvas")} />
      {focus.label ? (
        <div className={styles.focusBadge} role="status">
          <strong>{focus.label}</strong>
          {focus.explanation ? <span>{focus.explanation}</span> : null}
        </div>
      ) : null}
      <MapStates
        hasCamera={selectedCamera !== undefined}
        sceneError={scene.isError}
        failed={map.failed}
        onRetry={() => void scene.refetch()}
      />
      {selectedCamera ? (
        <SceneTimePanel
          date={date}
          minDate={today}
          maxDate={forecastEnd(today)}
          hour={hour}
          altitude={sun.position.altitude}
          azimuth={sun.position.azimuth}
          sunset={sun.times.sunset}
          weather={weather.data}
          weatherPending={weather.isPending || weather.isFetching}
          onDate={(value) => {
            if (value) setDate(value)
          }}
          onHour={(value) => {
            if (Number.isInteger(value) && value >= 0 && value <= 23) setHour(value)
          }}
          onOverview={() =>
            map.instance.current?.jumpTo({
              center: [selectedCamera.center[0] ?? 0, selectedCamera.center[1] ?? 0],
              zoom: selectedCamera.zoom,
              bearing: selectedCamera.bearing,
              pitch: selectedCamera.pitch,
            })
          }
        />
      ) : null}
      {invalid || missingHeight ? (
        <p className={styles.warnings}>
          {invalid ? t("explore:map.geodataInvalid") : t("explore:map.noHeight")}
        </p>
      ) : null}
      {selectedCamera ? (
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

function MapStates({
  hasCamera,
  sceneError,
  failed,
  onRetry,
}: {
  hasCamera: boolean
  sceneError: boolean
  failed: boolean
  onRetry: () => void
}) {
  const { t } = useTranslation()
  if (failed)
    return (
      <div className={styles.empty}>
        <EmptyState
          icon="map"
          title={t("explore:map.unsupported")}
          description={t("explore:map.unsupportedText")}
        />
      </div>
    )
  if (sceneError)
    return (
      <div className={styles.empty}>
        <ErrorState title={t("explore:map.error")} onRetry={onRetry} />
      </div>
    )
  return !hasCamera ? (
    <div className={styles.empty}>
      <EmptyState
        icon="map"
        title={t("explore:map.empty")}
        description={t("explore:map.emptyText")}
      />
    </div>
  ) : null
}

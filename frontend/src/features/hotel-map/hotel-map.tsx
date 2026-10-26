import { useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { useRegions } from "@/entities/catalog"
import { useGeoFeatures, useHotelScene } from "@/entities/hotel"
import type { Camera, FactBrief, MatchedProperty, SearchResult } from "@/shared/api/hotel-types"
import { factLabel, matchedExplanation, matchedTitle } from "@/shared/geo/fact-label"
import { selectedFootprints } from "@/shared/geo/textured-building/selection"
import type { Locale } from "@/shared/i18n"
import { useLocale, useTranslation } from "@/shared/i18n"
import { motionMs } from "@/shared/motion"
import { ErrorState, MapAttribution } from "@/shared/ui"
import styles from "./hotel-map.module.css"
import { MapControls } from "./map-controls"
import { MapPin } from "./map-pin"
import { MapScale } from "./map-scale"
import { MapFocus, MapStatus, MapWarning } from "./map-status"
import { regionOverview, sceneData, sceneQuality } from "./scene-data"
import { forecastEnd, sceneToday, sunScene } from "./scene-time/scene-time"
import { SceneTimePanel } from "./scene-time/scene-time-panel"
import { useHotelMap } from "./use-hotel-map"
import { expandCluster } from "./use-result-pins"
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

function hasLine(features: readonly unknown[]) {
  return features.some((feature) => {
    const data = feature as { geometry?: { type?: string }; properties?: { kind?: string } }
    return (
      data.properties?.kind === "route" &&
      (data.geometry?.type === "LineString" || data.geometry?.type === "MultiLineString")
    )
  })
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
  const regionCamera = region?.default_camera
  const fallbackCamera = useMemo(() => regionOverview(regionCamera), [regionCamera])
  const { selectedCamera, buildings, highlights } = sceneData(
    scene.data,
    camera,
    fallbackCamera,
    geometry.data,
    results,
  )
  const hotel = results.find((item) => item.hotel.id === hotelId)
  const textured = useMemo(
    () => selectedFootprints(hotelId, scene.data, hotel ? [hotel] : []),
    [hotelId, scene.data, hotel],
  )
  const [lon, lat] = sceneLocation(hotel, selectedCamera)
  const sun = useMemo(() => sunScene(date, hour, lat, lon), [date, hour, lat, lon])
  const weather = useWeather(lon, lat, date, hour, selectedCamera !== undefined)
  const { invalid, missingHeight } = sceneQuality(buildings, highlights)
  const focusFeatures = geoRefs.length ? (geometry.data?.features ?? []) : []
  const focus = focusCopy(focusProperty, focusedFact, focusFeatures.length > 0, locale)
  const map = useHotelMap({
    camera: selectedCamera,
    buildings,
    texturedFootprints: textured.features,
    highlights,
    bounds,
    results,
    hotelId,
    focusFeatures,
    focusLabel: focus.label,
    sun: sun.position,
  })
  const overview = scene.data?.cameras.overview ?? selectedCamera
  const showOverview = (instant: boolean) => {
    if (!overview) return
    const options = {
      center: [overview.center[0] ?? 0, overview.center[1] ?? 0] as [number, number],
      zoom: overview.zoom,
      bearing: overview.bearing,
      pitch: overview.pitch,
    }
    if (instant) map.instance.current?.jumpTo(options)
    else map.instance.current?.flyTo({ ...options, duration: motionMs("--dur-draw") })
  }
  return (
    <section
      className={styles.stage}
      aria-label={t("explore:map.title")}
      data-textured-hotel={map.textureStatus === "ready" ? hotelId : undefined}
    >
      <section ref={map.container} className={styles.canvas} aria-label={t("explore:map.canvas")} />
      {map.markers.map((view) =>
        createPortal(
          <MapPin
            view={view}
            onSelect={onSelect}
            onExpand={(cluster, keyboard) => {
              const instance = map.instance.current
              if (instance)
                void expandCluster(
                  instance,
                  cluster.clusterId,
                  cluster.position,
                  keyboard,
                  motionMs("--dur-panel"),
                )
            }}
          />,
          view.element,
          view.key,
        ),
      )}
      <MapStatus
        hasCamera={selectedCamera !== undefined}
        sceneError={scene.isError}
        failed={map.failed}
        ready={map.ready}
        onRetry={() => void scene.refetch()}
      />
      <div className={styles.topStart}>
        <MapFocus
          label={focus.label}
          explanation={focus.explanation}
          route={hasLine(focusFeatures)}
        />
        {geometry.isError ? (
          <div className={styles.notice}>
            <ErrorState
              title={t("explore:map.geometryError")}
              onRetry={() => void geometry.refetch()}
            />
          </div>
        ) : null}
      </div>

      {selectedCamera ? (
        <div className={styles.bottom}>
          <div className={styles.bottomStart}>
            <MapWarning
              invalid={invalid}
              missingHeight={missingHeight}
              textureStatus={map.textureStatus}
            />
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
              onDate={setDate}
              onHour={(value) => {
                if (Number.isInteger(value) && value >= 0 && value <= 23) setHour(value)
              }}
            />
          </div>
          <div className={styles.meta}>
            <MapScale map={map.instance} ready={map.ready} />
            <MapAttribution
              label={t("explore:map.attributionTitle")}
              osm={t("explore:map.attribution")}
              terrain={t("explore:map.terrainAttribution")}
            />
          </div>
        </div>
      ) : null}
      <MapControls
        map={map.instance}
        ready={map.ready}
        disabled={!selectedCamera || map.failed || !map.ready}
        onOverview={showOverview}
      />
    </section>
  )
}

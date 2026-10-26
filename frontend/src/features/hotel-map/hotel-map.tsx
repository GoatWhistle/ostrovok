import { type ReactNode, useEffect, useMemo, useState } from "react"
import { useRegions } from "@/entities/catalog"
import { useHotelScene } from "@/entities/hotel"
import type { Camera, FactBrief, MatchedProperty, SearchResult } from "@/shared/api/hotel-types"
import { matchedValue } from "@/shared/geo/fact-label"
import { selectedFootprints } from "@/shared/geo/textured-building/selection"
import { useLocale, useTranslation } from "@/shared/i18n"
import { motionMs } from "@/shared/motion"
import { ErrorState, MapAttribution } from "@/shared/ui"
import styles from "./hotel-map.module.css"
import { MapControls } from "./map-controls"
import { MapFocus } from "./map-focus"
import { MapLegendToggle } from "./map-legend"
import { MapScale } from "./map-scale"
import { MapStatus, mapNotes } from "./map-status"
import { MapPins } from "./markers/map-pins"
import { useFocusGeometry } from "./markers/use-focus-geometry"
import { WalkSummary } from "./markers/walk-summary"
import {
  focusCopy,
  hasLine,
  regionOverview,
  resultCorners,
  sceneData,
  sceneLocation,
  sceneQuality,
} from "./scene-data"
import { SceneSun } from "./scene-time/scene-sun"
import { forecastEnd, OVERVIEW_SUN, sceneToday, sunScene } from "./scene-time/scene-time"
import { SceneTimePanel } from "./scene-time/scene-time-panel"
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
  readonly bottomCenter?: ReactNode
  readonly onPlace: (id: string) => void
  readonly onTimeChange: (date: string, hour: number) => void
  readonly onSelect: (result: SearchResult) => void
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
  onPlace,
  onTimeChange,
  bottomCenter,
}: HotelMapProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const [today] = useState(sceneToday)
  const [date, setDate] = useState(today)
  const [hour, setHour] = useState(16)
  const scene = useHotelScene(hotelId)
  const regions = useRegions()
  const hotel = results.find((item) => item.hotel.id === hotelId)
  const geometry = useFocusGeometry(geoRefs, hotel)
  useEffect(() => onTimeChange(date, hour), [onTimeChange, date, hour])
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
  const textured = useMemo(
    () => selectedFootprints(hotelId, scene.data, hotel ? [hotel] : []),
    [hotelId, scene.data, hotel],
  )
  const place = hotel ?? results[0]
  const [lon, lat] = sceneLocation(place, selectedCamera)
  const sun = useMemo(() => sunScene(date, hour, lat, lon), [date, hour, lat, lon])
  const weather = useWeather(lon, lat, date, hour, place !== undefined)
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
    focusLabel: matchedValue(focusProperty?.fact ?? focusedFact, locale),
    sun: place ? sun.position : OVERVIEW_SUN,
  })
  const overview = scene.data?.cameras.overview ?? selectedCamera
  const showOverview = (instant: boolean) => {
    const corners = hotelId ? undefined : resultCorners(results)
    const duration = instant ? 0 : motionMs("--dur-draw")
    if (corners) {
      map.instance.current?.fitBounds(corners, { duration, padding: 64, maxZoom: 15 })
      return
    }
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
      {place ? (
        <SceneSun
          map={map.instance}
          ready={map.ready}
          azimuth={sun.position.azimuth}
          altitude={sun.position.altitude}
        />
      ) : null}
      <MapPins views={map.markers} map={map.instance} onSelect={onSelect} onPlace={onPlace} />
      <MapStatus
        hasCamera={selectedCamera !== undefined}
        sceneError={scene.isError}
        failed={map.failed}
        ready={map.ready}
        onRetry={() => void scene.refetch()}
      />
      <div className={styles.topStart} data-map-obstacle>
        <MapFocus
          label={focus.label}
          explanation={focus.explanation}
          fact={focusedFact}
          property={focusProperty}
          route={hasLine(focusFeatures)}
        >
          <WalkSummary features={focusFeatures} />
        </MapFocus>
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
          <div className={styles.bottomStart} data-map-obstacle>
            {place ? (
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
            ) : null}
          </div>
          <div className={styles.bottomCenter} data-map-obstacle>
            {bottomCenter}
          </div>
          <div className={styles.meta} data-map-obstacle>
            <MapScale map={map.instance} ready={map.ready} />
            <MapLegendToggle notes={mapNotes(invalid, missingHeight, map.textureStatus)} />
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

import { type ReactNode, useEffect, useMemo, useState } from "react"
import { useRegions } from "@/entities/catalog"
import { useHotelGeometry, useHotelScene } from "@/entities/hotel"
import type { Camera, FactBrief, MatchedProperty, SearchResult } from "@/shared/api/hotel-types"
import type { SearchJourney } from "@/shared/api/search-journey"
import { APPEARANCES } from "@/shared/geo/appearance/packages"
import type { MapAppearance } from "@/shared/geo/appearance/types"
import { matchedValue } from "@/shared/geo/facts/fact-label"
import { selectedFootprints } from "@/shared/geo/textured-building/selection"
import { useLocale, useTranslation } from "@/shared/i18n"
import { useMapAppearance } from "@/shared/theme"
import { MapHeading } from "./controls/map-heading"
import { MapMeta } from "./controls/map-meta"
import styles from "./hotel-map.module.css"
import { MapControls } from "./map-controls"
import { MapStatus, mapNotes } from "./map-status"
import { MapPins } from "./markers/map-pins"
import { showMapOverview } from "./rendering/map-overview"
import { identityOverview, useMapIdentity } from "./rendering/use-map-identity"
import { useMapInsets } from "./rendering/use-map-insets"
import { focusCopy, sceneData, sceneLocation, sceneQuality } from "./scene-data"
import { SceneSun } from "./scene-time/scene-sun"
import { sceneToday } from "./scene-time/scene-time"
import { useSunPreview } from "./scene-time/use-sun-preview"
import { useSunTheme } from "./scene-time/use-sun-theme"
import { SearchRouteOverlay } from "./search/search-route-overlay"
import { SearchStatus } from "./search/search-status"
import { displaySun } from "./search/search-sun"
import { useHotelMap } from "./use-hotel-map"

export interface HotelMapProps {
  readonly journey?: SearchJourney | undefined
  readonly onRetrySearch?: () => void
  readonly onCandidate?: (id: string) => void
  readonly returnToHotel?: boolean
  readonly fullMap?: boolean
  readonly previewing?: boolean
  readonly hotelCard?: ReactNode
  readonly onExpand?: () => void
  readonly onExit?: () => void
  readonly visible: boolean
  readonly hotelId: string | undefined
  readonly camera: Camera | undefined
  readonly geoRefs: readonly string[]
  readonly focusedFact: FactBrief | undefined
  readonly focusProperty: MatchedProperty | undefined
  readonly regionId: string | undefined
  readonly results: readonly SearchResult[]
  readonly bounds: readonly number[] | undefined
  readonly bottomCenter?: ReactNode
  readonly onAppearance: (id: MapAppearance) => void
  readonly onPlace: (id: string) => void
  readonly onTimeChange: (date: string, hour: number) => void
  readonly onSelect: (result: SearchResult) => void
}

export function HotelMap({
  visible,
  journey,
  onRetrySearch = () => {},
  onCandidate = () => {},
  fullMap = false,
  returnToHotel = false,
  previewing = false,
  hotelCard,
  onExpand,
  onExit,
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
  onAppearance,
  bottomCenter,
}: HotelMapProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const appearance = useMapAppearance()
  const [date] = useState(sceneToday)
  const [hour, setHour] = useState(APPEARANCES[appearance.id].sceneHour)
  useEffect(() => {
    setHour(APPEARANCES[appearance.id].sceneHour)
  }, [appearance.id])
  const scene = useHotelScene(hotelId)
  const regions = useRegions()
  const hotel = results.find((item) => item.hotel.id === hotelId)
  const identity = useMapIdentity(hotel, hotelId)
  const geometry = useHotelGeometry(geoRefs, identity)
  useEffect(() => onTimeChange(date, hour), [onTimeChange, date, hour])
  const region =
    regions.data?.items?.find((item) => item.id === regionId) ?? regions.data?.items?.[0]
  const regionCamera = region?.default_camera
  const fallbackCamera = useMemo(
    () =>
      identityOverview(identity, regionCamera) ?? {
        center: [0, 20],
        zoom: 2,
        pitch: 0,
        bearing: 0,
      },
    [identity, regionCamera],
  )
  const { selectedCamera, buildings, highlights } = sceneData(
    scene.data,
    camera,
    fallbackCamera,
    geometry.data,
    results,
  )
  const textured = useMemo(
    () =>
      selectedFootprints(
        hotelId,
        scene.data,
        results.filter((item) => item.hotel.id === hotelId),
      ),
    [hotelId, scene.data, results],
  )
  const place = hotel ?? results[0]
  const [lon, lat] = sceneLocation(place, selectedCamera)
  const { sun, preview } = useSunPreview({ date, hour, lat, lon, setHour })
  useSunTheme(sun.position.altitude, `${date}:${hour}`)
  const { invalid, missingHeight } = sceneQuality(buildings, highlights)
  const focusFeatures = geoRefs.length ? (geometry.data?.features ?? []) : []
  const focus = focusCopy(focusProperty, focusedFact, focusFeatures.length > 0, locale)
  const map = useHotelMap({
    visible,
    journey,
    onCandidate,
    previewing,
    camera: selectedCamera,
    buildings,
    texturedFootprints: textured.features,
    highlights,
    bounds,
    results,
    hotelId,
    location: identity,
    focusFeatures,
    focusLabel: matchedValue(focusProperty?.fact ?? focusedFact, locale),
    sun: displaySun(journey?.sending, Boolean(place), sun.position),
  })
  const insets = useMapInsets(map.instance, map.active, Boolean(hotelCard))
  const overview = scene.data?.cameras.overview ?? selectedCamera
  return (
    <section
      ref={insets.stage}
      className={styles.stage}
      data-popover-boundary
      data-full-map={fullMap}
      aria-label={t("explore:map.title")}
      data-map-active={map.active}
      data-textured-hotel={map.textureStatus === "ready" ? hotelId : undefined}
    >
      <section ref={map.container} className={styles.canvas} aria-label={t("explore:map.canvas")} />
      {place ? (
        <SceneSun
          map={map.instance}
          ready={map.active}
          azimuth={sun.position.azimuth}
          altitude={sun.position.altitude}
          preview={preview}
        />
      ) : null}
      <SearchRouteOverlay map={map.instance} scene={map.searchScene} active={map.active} />
      {journey ? (
        <SearchStatus journey={journey} scene={map.searchScene} onRetry={onRetrySearch} />
      ) : null}
      <MapPins views={map.markers} map={map.instance} onSelect={onSelect} onPlace={onPlace} />
      <MapStatus
        hasCamera={selectedCamera !== undefined}
        sceneError={scene.isError}
        failed={map.failed}
        ready={map.ready}
        onRetry={() => void scene.refetch()}
      />
      <MapHeading
        fullMap={fullMap}
        returnToHotel={returnToHotel}
        onExit={onExit}
        focus={focus}
        fact={focusedFact}
        property={focusProperty}
        features={focusFeatures}
        failed={geometry.isError}
        onRetry={() => void geometry.refetch()}
      />
      {selectedCamera ? (
        <div className={styles.bottom}>
          <div className={styles.bottomCenter} data-map-obstacle>
            {bottomCenter}
          </div>
          <MapMeta
            map={map.instance}
            ready={map.ready}
            notes={mapNotes(invalid, missingHeight, map.textureStatus)}
          />
        </div>
      ) : null}
      {hotelCard ? (
        <div ref={insets.card} className={styles.hotelCard} data-map-obstacle>
          {hotelCard}
        </div>
      ) : null}
      <MapControls
        fullMap={fullMap}
        onExpand={onExpand}
        map={map.instance}
        ready={map.ready}
        disabled={!selectedCamera || map.failed || !map.ready}
        onOverview={(instant) =>
          showMapOverview(map.instance.current, overview, hotelId, results, instant)
        }
        onAppearance={onAppearance}
      />
    </section>
  )
}

import { lazy, Suspense, useEffect, useState } from "react"
import { useHotel } from "@/entities/hotel"
import { hotelPoint } from "@/shared/geo/hotel-point"
import { useInViewport } from "@/shared/hooks"
import { useTranslation } from "@/shared/i18n"
import { Button, Card, ContentBoundary, EmptyState, Skeleton } from "@/shared/ui"
import styles from "./hotel-location.module.css"

const LocationMap = lazy(() =>
  import("./location-map").then((module) => ({ default: module.LocationMap })),
)

export function HotelLocation({
  hotelId,
  geoRefs,
  onOpenMap,
}: {
  readonly hotelId: string
  readonly geoRefs: readonly string[]
  readonly onOpenMap: () => void
}) {
  const { t } = useTranslation()
  const hotel = useHotel(hotelId)
  const viewport = useInViewport()
  const [opened, setOpened] = useState(false)
  useEffect(() => {
    if (viewport.visible) setOpened(true)
  }, [viewport.visible])
  const identity = hotel.data?.hotel
  if (!identity && hotel.isError) return null
  const point = hotelPoint(identity?.location)
  return (
    <Card title={t("explore:location.title")} className={styles.location} data-hotel-location>
      {identity ? (
        <p className={styles.address}>{identity.address || t("explore:location.noAddress")}</p>
      ) : (
        <Skeleton lines={2} />
      )}
      <section ref={viewport.ref} className={styles.frame} aria-label={t("explore:location.map")}>
        {!identity ? (
          <Skeleton shape="block" />
        ) : !point ? (
          <EmptyState icon="pin" title={t("explore:location.noCoordinates")} />
        ) : opened ? (
          <ContentBoundary
            fallback={<EmptyState icon="map" title={t("explore:location.unavailable")} />}
          >
            <Suspense fallback={<Skeleton shape="block" />}>
              <LocationMap hotel={identity} point={point} geoRefs={geoRefs} />
            </Suspense>
          </ContentBoundary>
        ) : (
          <Skeleton shape="block" />
        )}
      </section>
      {point ? (
        <Button variant="secondary" icon="expand" onClick={onOpenMap}>
          {t("explore:location.openMap")}
        </Button>
      ) : null}
    </Card>
  )
}

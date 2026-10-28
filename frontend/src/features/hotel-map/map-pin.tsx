import { matchScore } from "@/entities/hotel"
import type { SearchResult } from "@/shared/api/hotel-types"
import { useTranslation } from "@/shared/i18n"
import { Button, Icon } from "@/shared/ui"
import styles from "./map-pin.module.css"
import type { ClusterView, HotelView, MarkerView, PlaceView } from "./marker-view"

export interface MapPinProps {
  readonly view: MarkerView
  readonly onPlace: (id: string) => void
  readonly onSelect: (result: SearchResult) => void
  readonly onExpand: (view: ClusterView, keyboard: boolean) => void
}

function HotelPin({ view, onSelect }: { view: HotelView; onSelect: MapPinProps["onSelect"] }) {
  const { t } = useTranslation()
  const { full, total } = matchScore(view.result)
  const name = view.result.hotel.name
  const state = total === 0 ? "nodata" : full === total ? "complete" : "partial"
  return (
    <Button
      variant="ghost"
      size="compact"
      className={styles.pin}
      data-kind="hotel"
      data-state={state}
      data-selected={view.selected}
      aria-pressed={view.selected}
      aria-label={
        total === 0
          ? t("explore:map.pinNoData", { name })
          : t("explore:map.pin", { name, full, total })
      }
      onClick={() => onSelect(view.result)}
    >
      <span className={styles.face} aria-hidden="true">
        {total === 0 ? null : (
          <>
            <span className={styles.dot} />
            <span className={styles.score}>{t("explore:results.score", { full, total })}</span>
          </>
        )}
        <span data-map-label className={`${styles.bubble} ${styles.label}`}>
          {name}
        </span>
      </span>
    </Button>
  )
}

function ClusterPin({ view, onExpand }: { view: ClusterView; onExpand: MapPinProps["onExpand"] }) {
  const { t } = useTranslation()
  return (
    <Button
      variant="ghost"
      size="compact"
      className={styles.pin}
      data-kind="cluster"
      data-size={view.count < 10 ? "small" : view.count < 100 ? "medium" : "large"}
      aria-label={t("explore:map.cluster", { count: view.count })}
      onClick={(event) => onExpand(view, event.detail === 0)}
    >
      {t("explore:map.clusterCount", { count: view.count })}
    </Button>
  )
}

function PlacePin({ view, onPlace }: { view: PlaceView; onPlace: MapPinProps["onPlace"] }) {
  const content = (
    <>
      <span className={styles.placeDot} aria-hidden="true" />
      <span data-map-label className={`${styles.bubble} ${styles.placeLabel}`}>
        {view.kind === "route" ? <Icon name="walk" size="sm" className={styles.routeIcon} /> : null}
        <span>{view.label}</span>
      </span>
    </>
  )
  if (view.placeId)
    return (
      <Button
        variant="ghost"
        className={styles.place}
        data-kind={view.kind}
        aria-label={view.ariaLabel}
        onClick={() => view.placeId && onPlace(view.placeId)}
      >
        {content}
      </Button>
    )
  return (
    <span role="img" className={styles.place} data-kind={view.kind} aria-label={view.label}>
      {content}
    </span>
  )
}

export function MapPin({ view, onSelect, onExpand, onPlace }: MapPinProps) {
  if (view.kind === "hotel") return <HotelPin view={view} onSelect={onSelect} />
  if (view.kind === "cluster") return <ClusterPin view={view} onExpand={onExpand} />
  return <PlacePin view={view} onPlace={onPlace} />
}

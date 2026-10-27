import { useEffect, useRef } from "react"
import { HotelSummaryCard, useHotel } from "@/entities/hotel"
import type { useHotelWorkspace } from "@/features/hotel-search"
import { PlaceDetails } from "@/features/place-details"
import { useTranslation } from "@/shared/i18n"
import { Button, CloseButton, ErrorState, ScrollArea, Skeleton } from "@/shared/ui"
import styles from "./map-hotel.module.css"
import { useSheet } from "./use-sheet-drag"

type Workspace = ReturnType<typeof useHotelWorkspace>
export function MapHotel({
  state,
  time,
  onOpen,
  onClose,
}: {
  readonly onClose: () => void
  readonly state: Workspace
  readonly time: { readonly date: string; readonly hour: number }
  readonly onOpen: (section?: "offers") => void
}) {
  const { t } = useTranslation()
  const result = state.results.find((item) => item.hotel.id === state.hotelId)
  const detail = useHotel(result ? undefined : state.hotelId)
  const hotel = result?.hotel ?? detail.data?.hotel
  const { snap, drag, full, style, toggle } = useSheet()
  const collapsed = snap === "peek"
  const close = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!globalThis.matchMedia?.("(pointer: coarse)").matches)
      close.current?.focus({ preventScroll: true })
  }, [])
  useEffect(() => {
    if (state.placeId) close.current?.focus({ preventScroll: true })
  }, [state.placeId])
  function dismiss() {
    if (state.placeId) state.closePlace()
    else onClose()
    document.querySelector<HTMLElement>(".maplibregl-canvas")?.focus({ preventScroll: true })
  }
  return (
    <aside
      className={styles.card}
      data-map-hotel
      data-collapsed={collapsed}
      data-snap={snap}
      data-dragging={drag.dragging}
      style={style}
      aria-label={t("explore:map.selectedHotel")}
      {...drag.handlers}
    >
      <header className={styles.header}>
        <strong>{collapsed && hotel ? hotel.name : t("explore:map.selectedHotel")}</strong>
        <div className={styles.actions}>
          <Button
            variant="ghost"
            iconOnly
            icon={full ? "chevron-down" : "arrow-up"}
            className={styles.collapse}
            aria-expanded={full}
            aria-controls="map-hotel-content"
            title={t(full ? "explore:map.collapseCard" : "explore:map.expandCard")}
            onClick={(event) => toggle(event.detail === 0)}
          >
            {t(full ? "explore:map.collapseCard" : "explore:map.expandCard")}
          </Button>
          <CloseButton ref={close} label={t("explore:map.closeCard")} onClick={dismiss} />
        </div>
      </header>
      <ScrollArea className={styles.content} id="map-hotel-content">
        {state.placeId && state.hotelId ? (
          <PlaceDetails
            id={state.placeId}
            hotelId={state.hotelId}
            date={time.date}
            hour={time.hour}
            onBack={state.closePlace}
            onRoute={state.placeRoute}
          />
        ) : hotel ? (
          <>
            <HotelSummaryCard
              hotel={hotel}
              matched={result?.matched ?? []}
              selected={false}
              idPrefix="map-hotel"
              onSelect={() => onOpen()}
              onRooms={() => onOpen("offers")}
              onProperty={(item) => {
                if (result) state.property(result, item)
              }}
              onPreview={(item) => {
                if (result) state.preview(result, item)
              }}
            />
            <Button icon="expand" onClick={() => onOpen()}>
              {t("explore:surfaces.openHotelPage")}
            </Button>
          </>
        ) : detail.isError ? (
          <ErrorState title={t("explore:details.error")} onRetry={() => void detail.refetch()} />
        ) : (
          <Skeleton lines={4} />
        )}
      </ScrollArea>
    </aside>
  )
}

import { type Ref, useEffect, useRef } from "react"
import { useHotel } from "@/entities/hotel"
import { HotelLocation } from "@/features/hotel-location"
import type { useHotelWorkspace } from "@/features/hotel-search"
import { useDocumentTitle, useTranslation } from "@/shared/i18n"
import { Button, ScrollArea } from "@/shared/ui"
import { HotelContent } from "../hotel-content"
import styles from "./full-hotel.module.css"
import { useHotelSection } from "./use-hotel-section"

type Workspace = ReturnType<typeof useHotelWorkspace>
interface FullHotelProps {
  readonly state: Workspace
  readonly time: { date: string; hour: number }
  readonly restoreScroll: boolean
  readonly scrollRef: Ref<HTMLDivElement>
  readonly onOpenMap: () => void
  readonly onBack: () => void
}
export function FullHotel({
  state,
  time,
  scrollRef,
  restoreScroll,
  onBack,
  onOpenMap,
}: FullHotelProps) {
  const { t } = useTranslation()
  const hotel = useHotel(state.hotelId)
  useDocumentTitle(hotel.data?.hotel.name ?? t("explore:details.title"))
  const back = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    back.current?.focus({ preventScroll: true })
  }, [])
  const page = useHotelSection(state.hotelId, state.navigation.route.section, restoreScroll)

  return (
    <section ref={page} className={styles.page} aria-label={t("explore:surfaces.hotelPage")}>
      <div className={styles.bar}>
        <Button ref={back} variant="ghost" icon="chevron-left" onClick={onBack}>
          {t("explore:surfaces.back")}
        </Button>
        {state.hotelId ? (
          <Button
            variant="ghost"
            icon="compare"
            aria-pressed={state.compared.includes(state.hotelId)}
            onClick={() => state.hotelId && state.compare(state.hotelId)}
          >
            {t(
              state.compared.includes(state.hotelId)
                ? "explore:results.removeCompare"
                : "explore:results.compare",
            )}
          </Button>
        ) : null}
      </div>
      <ScrollArea ref={scrollRef} className={styles.content} tabIndex={-1}>
        <HotelContent state={state} time={time} />
        {state.hotelId && !state.factId && !state.placeId ? (
          <HotelLocation hotelId={state.hotelId} geoRefs={state.geoRefs} onOpenMap={onOpenMap} />
        ) : null}
      </ScrollArea>
    </section>
  )
}

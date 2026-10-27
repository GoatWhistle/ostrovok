import { type Ref, useEffect, useRef } from "react"
import { useHotel } from "@/entities/hotel"
import type { useHotelWorkspace } from "@/features/hotel-search"
import { useDocumentTitle, useTranslation } from "@/shared/i18n"
import { Button, ScrollArea } from "@/shared/ui"
import { HotelContent } from "../hotel-content"
import styles from "./full-hotel.module.css"

type Workspace = ReturnType<typeof useHotelWorkspace>
interface FullHotelProps {
  readonly state: Workspace
  readonly time: { date: string; hour: number }
  readonly scrollRef: Ref<HTMLDivElement>
  readonly onBack: () => void
}
export function FullHotel({ state, time, scrollRef, onBack }: FullHotelProps) {
  const { t } = useTranslation()
  const hotel = useHotel(state.hotelId)
  useDocumentTitle(hotel.data?.hotel.name ?? t("explore:details.title"))
  const back = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    back.current?.focus({ preventScroll: true })
  }, [])
  useEffect(() => {
    if (!state.navigation.route.section || !hotel.data) return
    const id =
      state.navigation.route.section === "offers" || state.navigation.route.section === "rooms"
        ? `${state.hotelId}-rooms`
        : undefined
    if (id) {
      const target = document.getElementById(id)
      target?.scrollIntoView({ block: "start" })
      target?.focus({ preventScroll: true })
    }
  }, [state.hotelId, state.navigation.route.section, hotel.data])
  return (
    <section className={styles.page} aria-label={t("explore:surfaces.hotelPage")}>
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
      </ScrollArea>
    </section>
  )
}

import { FactDetails } from "@/features/fact-details"
import { HotelDetails } from "@/features/hotel-details"
import type { useHotelWorkspace } from "@/features/hotel-search"
import { PlaceDetails } from "@/features/place-details"
import { useTranslation } from "@/shared/i18n"
import { Swap } from "@/shared/motion"
import { Button, ScrollArea } from "@/shared/ui"
import styles from "./home-page.module.css"

type Workspace = ReturnType<typeof useHotelWorkspace>

export function SelectedHotel({
  state,
  time,
}: {
  readonly state: Workspace
  readonly time: { date: string; hour: number }
}) {
  const { t } = useTranslation()
  if (!state.hotelId) return null
  const selected = state.results.find((item) => item.hotel.id === state.hotelId)
  const compared = state.compared.includes(state.hotelId)
  const hotelId = state.hotelId
  return (
    <>
      <div className={styles.bar}>
        <Button variant="ghost" size="compact" icon="chevron-left" onClick={state.closeHotel}>
          {t("explore:panel.back")}
        </Button>
        <Button
          variant="ghost"
          size="compact"
          icon="compare"
          aria-pressed={compared}
          onClick={() => state.compare(hotelId)}
        >
          {compared ? t("explore:results.removeCompare") : t("explore:results.compare")}
        </Button>
      </div>
      <ScrollArea
        ref={state.detailRef}
        tabIndex={-1}
        className={styles.scroll}
        aria-label={t("explore:details.title")}
      >
        <Swap swapKey={state.placeId ?? state.factId ?? hotelId} as="div">
          {state.placeId ? (
            <PlaceDetails
              id={state.placeId}
              hotelId={hotelId}
              date={time.date}
              hour={time.hour}
              onBack={state.closePlace}
              onRoute={state.placeRoute}
            />
          ) : state.factId ? (
            <FactDetails hotelId={hotelId} factId={state.factId} onBack={state.closeFact} />
          ) : (
            <HotelDetails
              hotelId={hotelId}
              matched={selected?.matched ?? []}
              stay={state.search?.parsed}
              onProperty={(item) => selected && state.property(selected, item)}
              onFact={state.fact}
              onPreview={(item) => selected && state.preview(selected, item)}
            />
          )}
        </Swap>
      </ScrollArea>
    </>
  )
}

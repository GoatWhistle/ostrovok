import type { Ref } from "react"
import type { useHotelWorkspace } from "@/features/hotel-search"
import { useTranslation } from "@/shared/i18n"
import { Button, ScrollArea } from "@/shared/ui"
import { HotelContent } from "../hotel-content/hotel-content"
import styles from "./workspace-panel.module.css"

type Workspace = ReturnType<typeof useHotelWorkspace>

export function SelectedHotel({
  state,
  time,
  scrollRef,
  onBack,
}: {
  readonly onBack: () => void
  readonly scrollRef: Ref<HTMLDivElement>
  readonly state: Workspace
  readonly time: { date: string; hour: number }
}) {
  const { t } = useTranslation()
  if (!state.hotelId) return null
  const compared = state.compared.includes(state.hotelId)
  const hotelId = state.hotelId
  return (
    <>
      <div className={styles.bar}>
        <Button variant="ghost" size="compact" icon="chevron-left" onClick={onBack}>
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
        ref={scrollRef}
        tabIndex={-1}
        className={styles.detailScroll}
        aria-label={t("explore:details.title")}
      >
        <HotelContent state={state} time={time} />
      </ScrollArea>
    </>
  )
}

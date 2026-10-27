import type { Ref } from "react"
import type { useHotelWorkspace } from "@/features/hotel-search"
import { SearchResults } from "@/features/search-results"
import type { Resizable } from "@/shared/hooks/use-resizable"
import { useTranslation } from "@/shared/i18n"
import { ResizeHandle, ScrollArea } from "@/shared/ui"
import styles from "./home-page.module.css"
import { SelectedHotel } from "./selected-hotel"

type Workspace = ReturnType<typeof useHotelWorkspace>
interface WorkspacePanelProps {
  readonly state: Workspace
  readonly time: { date: string; hour: number }
  readonly fullHotel: boolean
  readonly scrollRef: Ref<HTMLDivElement>
  readonly size: Resizable
  readonly onSelect: Workspace["select"]
  readonly onMove: (action: () => void) => void
}
export function WorkspacePanel({
  state,
  time,
  fullHotel,
  scrollRef,
  size,
  onSelect,
  onMove,
}: WorkspacePanelProps) {
  const { t } = useTranslation()
  const detail = Boolean(state.hotelId && !fullHotel)
  function openPage() {
    const id = state.hotelId
    if (id) onMove(() => state.navigation.openHotelPage(id))
  }
  return (
    <aside className={styles.panel} aria-label={t("explore:panel.title")}>
      {!detail ? (
        <ResizeHandle
          label={t("explore:panel.resizePanel")}
          edge="end"
          current={size.width ?? size.min}
          resizable={size}
        />
      ) : null}
      <div className={styles.swap}>
        {detail ? (
          <SelectedHotel
            state={state}
            time={time}
            scrollRef={scrollRef}
            onBack={() => onMove(state.closeHotel)}
            onOpenPage={openPage}
          />
        ) : (
          <ScrollArea ref={state.listRef} className={styles.scroll}>
            <SearchResults
              response={state.search}
              pending={state.sending || state.chatLoading}
              hotelId={state.hotelId}
              onSelect={onSelect}
              onProperty={state.property}
              onPreview={state.preview}
            />
          </ScrollArea>
        )}
      </div>
    </aside>
  )
}

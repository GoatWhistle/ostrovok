import { type CSSProperties, useCallback, useState } from "react"
import { HotelMap } from "@/features/hotel-map"
import { useHotelWorkspace, type WorkspaceView } from "@/features/hotel-search"
import { type ChatView, SearchChat } from "@/features/search-chat"
import { SearchResults } from "@/features/search-results"
import { useResizable } from "@/shared/hooks"
import { useDocumentTitle, useTranslation } from "@/shared/i18n"
import { Swap, withViewTransition } from "@/shared/motion"
import { ResizeHandle, ScrollArea, Segmented } from "@/shared/ui"
import { CompareDock } from "./compare-dock"
import styles from "./home-page.module.css"
import { Landing } from "./landing"
import { SelectedHotel } from "./selected-hotel"
import { useFreshStart } from "./use-fresh-start"

export function HomePage() {
  const { t } = useTranslation()
  useDocumentTitle(null)
  const state = useHotelWorkspace()
  const [sceneTime, setSceneTime] = useState({ date: "", hour: 16 })
  const onTimeChange = useCallback((date: string, hour: number) => setSceneTime({ date, hour }), [])
  const [stay, setStay] = useState(false)
  const [chatView, setChatView] = useState<ChatView>("chat")
  useFreshStart(() => {
    setStay(false)
    state.reset()
  })
  const selected = state.results.find((item) => item.hotel.id === state.hotelId)
  const panelSize = useResizable({
    storageKey: "factmap-panel-width",
    edge: "end",
    initial: "--workspace-panel",
    min: "--workspace-panel-min",
    max: "--workspace-panel-max",
    variable: "--panel-width",
  })
  const chatSize = useResizable({
    storageKey: "factmap-chat-width",
    edge: "start",
    initial: "--workspace-chat",
    min: "--workspace-panel-min",
    max: "--workspace-panel-max",
    variable: "--chat-width",
  })
  const start =
    !stay && state.messages.length === 0 && !state.outgoing && !state.chatLoading && !state.search
  const send = (message: string) => void withViewTransition("layout", () => state.send(message))
  const sizes = {
    ...(panelSize.width ? { "--panel-width": `${panelSize.width}px` } : {}),
    ...(chatSize.width ? { "--chat-width": `${chatSize.width}px` } : {}),
  } as CSSProperties
  if (start)
    return (
      <Landing
        pending={state.sending}
        recent={state.history}
        onSend={send}
        onOpen={(id) => {
          setStay(true)
          setChatView("chat")
          state.openConversation(id)
        }}
        onHistory={() => {
          setStay(true)
          setChatView("history")
        }}
      />
    )
  return (
    <div className={styles.page}>
      <div className={styles.tabs}>
        <Segmented<WorkspaceView>
          label={t("explore:panel.tabs")}
          options={[
            { value: "chat", label: t("explore:panel.chat"), icon: "send" },
            { value: "hotels", label: t("explore:panel.hotels"), icon: "list" },
            { value: "map", label: t("explore:panel.map"), icon: "map" },
          ]}
          value={state.view}
          onChange={state.setView}
        />
      </div>
      <div className={styles.workspace} data-view={state.view} data-resize-root style={sizes}>
        <aside className={styles.panel} aria-label={t("explore:panel.title")}>
          <ResizeHandle
            label={t("explore:panel.resizePanel")}
            edge="end"
            current={panelSize.width ?? panelSize.min}
            resizable={panelSize}
          />
          <Swap swapKey={state.hotelId ? "hotel" : "list"} as="div" className={styles.swap}>
            {state.hotelId ? (
              <SelectedHotel state={state} time={sceneTime} />
            ) : (
              <ScrollArea className={styles.scroll}>
                <SearchResults
                  response={state.search}
                  pending={state.sending || state.chatLoading}
                  hotelId={state.hotelId}
                  onSelect={state.select}
                  onProperty={state.property}
                  onPreview={state.preview}
                />
              </ScrollArea>
            )}
          </Swap>
        </aside>
        <div className={styles.map}>
          <HotelMap
            hotelId={state.hotelId}
            camera={state.camera}
            geoRefs={state.geoRefs}
            focusedFact={state.focusedFact}
            focusProperty={state.focusProperty}
            regionId={state.search ? "russia" : "sochi"}
            results={state.results}
            bounds={state.bounds}
            onSelect={state.select}
            onPlace={state.openPlace}
            onTimeChange={onTimeChange}
            bottomCenter={<CompareDock ids={state.compared} limit={state.limitReached} />}
          />
        </div>
        <div className={styles.chat}>
          <ResizeHandle
            label={t("explore:panel.resizeChat")}
            edge="start"
            current={chatSize.width ?? chatSize.min}
            resizable={chatSize}
          />
          <SearchChat
            messages={state.messages}
            conversationId={state.conversationId}
            history={state.history}
            search={state.search}
            searchMessageId={state.searchMessageId}
            outgoing={state.outgoing}
            selectedHotel={selected?.hotel.name}
            loading={state.chatLoading}
            sending={state.sending}
            failed={state.chatFailed}
            onSend={state.send}
            onRetry={state.retry}
            onShowOnMap={state.showOnMap}
            onShowList={() => state.setView("hotels")}
            onReset={() => {
              setStay(true)
              state.reset()
            }}
            onOpenConversation={state.openConversation}
            view={chatView}
            onView={setChatView}
            onRename={state.renameConversation}
            onDelete={state.deleteConversation}
          />
        </div>
      </div>
      {state.view === "hotels" ? (
        <div className={styles.mobileDock}>
          <CompareDock ids={state.compared} limit={state.limitReached} />
        </div>
      ) : null}
    </div>
  )
}

import { type CSSProperties, useCallback, useRef, useState } from "react"
import { HotelStayProvider } from "@/entities/hotel"
import { HotelMap } from "@/features/hotel-map"
import { useHotelWorkspace, type WorkspaceView } from "@/features/hotel-search"
import { type ChatView, SearchChat } from "@/features/search-chat"
import { SearchResults } from "@/features/search-results"
import { useResizable } from "@/shared/hooks"
import { useDocumentTitle, useTranslation } from "@/shared/i18n"
import { Swap, useInputModality, withViewTransition } from "@/shared/motion"
import { ResizeHandle, ScrollArea, Segmented } from "@/shared/ui"
import { CompareDock } from "./compare-dock"
import styles from "./home-page.module.css"
import { Landing } from "./landing"
import { SelectedHotel } from "./selected-hotel"
import { useAppearanceLocation } from "./use-appearance-location"
import { useFreshStart } from "./use-fresh-start"

export function HomePage() {
  const { t } = useTranslation()
  useDocumentTitle(null)
  const state = useHotelWorkspace()
  useAppearanceLocation(state.navigation.route.appearance, state.navigation.setAppearance)
  const [sceneTime, setSceneTime] = useState({ date: "", hour: 16 })
  const onTimeChange = useCallback((date: string, hour: number) => setSceneTime({ date, hour }), [])
  const modality = useInputModality(true)
  const mapMounted = useRef(false)
  if (["workspace", "hotel-panel", "map"].includes(state.surface)) mapMounted.current = true
  const [chatView, setChatView] = useState<ChatView>("chat")
  useFreshStart(() => {
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
  const start = state.surface === "landing"
  const send = (message: string) => {
    if (modality.instant) state.send(message)
    else void withViewTransition("layout", () => state.send(message))
  }
  const sizes = {
    ...(panelSize.width ? { "--panel-width": `${panelSize.width}px` } : {}),
    ...(chatSize.width ? { "--chat-width": `${chatSize.width}px` } : {}),
  } as CSSProperties
  if (start)
    return (
      <Landing
        pending={state.sending}
        draftKey={`chat:${state.navigation.scopeKey}`}
        recent={state.history}
        onSend={send}
        onOpen={(id) => {
          setChatView("chat")
          state.openConversation(id)
        }}
        onHistory={() => {
          state.navigation.begin()
          setChatView("history")
        }}
      />
    )
  return (
    <HotelStayProvider scopeKey={state.navigation.scopeKey} stay={state.search?.parsed}>
      <div className={styles.page} data-surface={state.surface}>
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
        <div
          className={styles.workspace}
          data-surface={state.surface}
          data-view={state.view}
          data-resize-root
          style={sizes}
        >
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
                <ScrollArea ref={state.listRef} className={styles.scroll}>
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
            {mapMounted.current ? (
              <HotelMap
                onAppearance={state.navigation.setAppearance}
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
            ) : null}
          </div>
          <div className={styles.chat}>
            <ResizeHandle
              label={t("explore:panel.resizeChat")}
              edge="start"
              current={chatSize.width ?? chatSize.min}
              resizable={chatSize}
            />
            <SearchChat
              draftKey={`chat:${state.navigation.scopeKey}`}
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
    </HotelStayProvider>
  )
}

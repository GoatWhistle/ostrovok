import { type CSSProperties, useCallback, useRef, useState } from "react"
import { HotelStayProvider } from "@/entities/hotel"
import { useHotelWorkspace, type WorkspaceView } from "@/features/hotel-search"
import { type SearchChatProps, useChatSidebar } from "@/features/search-chat"
import { useMediaQuery, useResizable, useVisualViewportHeight } from "@/shared/hooks"
import { useDocumentTitle } from "@/shared/i18n"
import { useInputModality, withViewTransition } from "@/shared/motion"
import { DockBar } from "./chat-dock/dock-bar"
import { CompareDock } from "./compare-dock/compare-dock"
import { FullHotel } from "./full-hotel/full-hotel"
import styles from "./home-page.module.css"
import { Landing } from "./landing/landing"
import { useAppearanceLocation } from "./navigation/use-appearance-location"
import { useFreshStart } from "./navigation/use-fresh-start"
import { useFullMap } from "./navigation/use-full-map"
import { useSurfaceScroll } from "./navigation/use-surface-scroll"
import { WorkspaceChat } from "./workspace-chat/workspace-chat"
import { WorkspaceMap } from "./workspace-map/workspace-map"
import { WorkspacePanel } from "./workspace-panel/workspace-panel"
import { WorkspaceSidebar } from "./workspace-sidebar/workspace-sidebar"
import { WorkspaceTabs } from "./workspace-tabs/workspace-tabs"

const TAB_SURFACES: readonly string[] = ["workspace", "hotel-panel"]

function useMapVisible(
  surface: ReturnType<typeof useHotelWorkspace>["surface"],
  view: WorkspaceView,
) {
  const narrow = useMediaQuery("(max-width: 63.99rem)")
  return (
    surface === "map" ||
    (!["landing", "conversation", "hotel-page"].includes(surface) && (!narrow || view === "map"))
  )
}

function isStandalone(state: ReturnType<typeof useHotelWorkspace>) {
  return (
    state.surface === "map" ||
    (state.surface === "hotel-page" &&
      (state.navigation.route.from !== "panel" || !state.navigation.route.chat))
  )
}

function layoutMove(instant: boolean) {
  return (action: () => void) => {
    if (instant) action()
    else void withViewTransition("layout", action)
  }
}

function panelStyle(width: number | null | undefined): CSSProperties {
  return (width ? { "--panel-width": `${width}px` } : {}) as CSSProperties
}

export function HomePage() {
  useDocumentTitle(null)
  const state = useHotelWorkspace()
  useAppearanceLocation(state.navigation.route.appearance, state.navigation.setAppearance)
  const [sceneTime, setSceneTime] = useState({ date: "", hour: 16 })
  const onTimeChange = useCallback((date: string, hour: number) => setSceneTime({ date, hour }), [])
  const modality = useInputModality(true)
  const mapMounted = useRef(false)
  mapMounted.current ||= ["workspace", "hotel-panel", "map"].includes(state.surface)
  const chats = useChatSidebar(modality.instant, state.surface === "conversation")
  const [dockOpen, setDockOpen] = useState(false)
  useFreshStart(state.clearTransient)
  const selected = state.results.find((item) => item.hotel.id === state.hotelId)
  const panelSize = useResizable({
    storageKey: "factmap-panel-width",
    edge: "end",
    initial: "--workspace-panel",
    min: "--workspace-panel-min",
    max: "--workspace-panel-max",
    variable: "--panel-width",
  })
  const wide = useMediaQuery("(min-width: 64rem)")
  useVisualViewportHeight(!wide)
  const docked = wide && ["workspace", "hotel-panel"].includes(state.surface)
  const fullHotel = state.surface === "hotel-page"
  const standalone = isStandalone(state)
  const chrome = state.surface !== "landing" && !standalone
  useFullMap(state.surface === "map", state.navigation.returnFromSurface)
  const scrollRef = useSurfaceScroll(
    `${state.navigation.scopeKey}:${state.hotelId}:${fullHotel ? "page" : "panel"}:${state.factId ?? state.placeId ?? "hotel"}`,
    state.detailRef,
  )
  const move = layoutMove(modality.instant)
  const select: typeof state.select = (result) => move(() => state.select(result))
  const start = state.surface === "landing"
  const mapVisible = useMapVisible(state.surface, state.view)
  const send = (message: string) => move(() => state.send(message))
  const sizes = panelStyle(panelSize.width)
  const chat: SearchChatProps = {
    draftKey: `chat:${state.navigation.scopeKey}`,
    messages: state.messages,
    conversationId: state.conversationId,
    history: state.history,
    search: state.search,
    searchMessageId: state.searchMessageId,
    outgoing: state.outgoing,
    selectedHotel: selected?.hotel.name,
    onClearHotel: () => move(state.closeHotel),
    loading: state.chatLoading,
    sending: state.sending,
    progress: state.progress,
    failed: state.chatFailed,
    onSend: state.send,
    onRetry: state.retry,
    onShowOnMap: state.showOnMap,
    onShowList: () => state.setView("hotels"),
    onReset: () => state.reset(),
    onOpenChats: chats.openChats,
  }
  const mapComposer = !wide && state.view === "map" && TAB_SURFACES.includes(state.surface)
  return (
    <HotelStayProvider scopeKey={state.navigation.scopeKey} stay={state.search?.parsed}>
      {start ? (
        <Landing
          pending={state.sending}
          draftKey={`chat:${state.navigation.scopeKey}`}
          recent={state.history}
          onSend={send}
          onOpen={state.openConversation}
          onHistory={() => {
            state.navigation.begin()
            chats.reveal()
          }}
        />
      ) : null}
      <div
        className={styles.page}
        data-surface={state.surface}
        data-standalone={standalone}
        data-chrome={standalone ? "bare" : undefined}
        hidden={start}
      >
        {chrome ? <WorkspaceSidebar state={state} sidebar={chats} /> : null}
        <div
          className={styles.workspace}
          data-surface={state.surface}
          data-docked={docked}
          data-searching={state.searchCompact}
          data-view={state.view}
          data-resize-root
          style={sizes}
        >
          {state.surface !== "map" ? (
            <WorkspacePanel
              state={state}
              time={sceneTime}
              fullHotel={fullHotel}
              scrollRef={scrollRef}
              size={panelSize}
              onSelect={select}
              onMove={move}
            />
          ) : null}
          <div className={styles.map}>
            <div className={styles.mapCanvas} hidden={fullHotel}>
              {mapMounted.current ? (
                <WorkspaceMap
                  state={state}
                  visible={mapVisible}
                  onSelect={select}
                  onTimeChange={onTimeChange}
                  time={sceneTime}
                  onMove={move}
                />
              ) : null}
            </div>
            {fullHotel ? (
              <FullHotel
                state={state}
                time={sceneTime}
                scrollRef={scrollRef}
                restoreScroll={scrollRef.restored && state.navigation.restoring}
                onBack={() => move(state.navigation.returnFromSurface)}
                onOpenMap={() => move(state.navigation.expandMap)}
              />
            ) : null}
          </div>
          {start ? null : (
            <WorkspaceChat docked={docked} open={dockOpen} onOpenChange={setDockOpen} chat={chat} />
          )}
        </div>
        <WorkspaceTabs surface={state.surface} value={state.view} onChange={state.setView} />
        {mapComposer ? (
          <div className={styles.mobileDock} data-composer>
            <DockBar
              chat={chat}
              variant="attached"
              onSend={(message) => {
                state.setView("chat")
                state.send(message)
              }}
              onExpand={() => state.setView("chat")}
            />
          </div>
        ) : null}
        {state.view === "hotels" ? (
          <div className={styles.mobileDock}>
            <CompareDock ids={state.compared} limit={state.limitReached} />
          </div>
        ) : null}
      </div>
    </HotelStayProvider>
  )
}

import { type CSSProperties, useCallback, useRef, useState } from "react"
import { HotelStayProvider } from "@/entities/hotel"
import { useHotelWorkspace, type WorkspaceView } from "@/features/hotel-search"
import type { ChatView } from "@/features/search-chat"
import { useMediaQuery, useResizable } from "@/shared/hooks"
import { useDocumentTitle, useTranslation } from "@/shared/i18n"
import { useInputModality, withViewTransition } from "@/shared/motion"
import { Segmented } from "@/shared/ui"
import { CompareDock } from "./compare-dock"
import { FullHotel } from "./full-hotel/full-hotel"
import styles from "./home-page.module.css"
import { Landing } from "./landing"
import { useAppearanceLocation } from "./use-appearance-location"
import { useFreshStart } from "./use-fresh-start"
import { useFullMap } from "./use-full-map"
import { useSurfaceScroll } from "./use-surface-scroll"
import { WorkspaceChat } from "./workspace-chat"
import { WorkspaceMap } from "./workspace-map"
import { WorkspacePanel } from "./workspace-panel"

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
  const docked = wide && ["workspace", "hotel-panel"].includes(state.surface)
  const fullHotel = state.surface === "hotel-page"
  const standalone = isStandalone(state)
  useFullMap(state.surface === "map", state.navigation.returnFromSurface)
  const scrollRef = useSurfaceScroll(
    `${state.navigation.scopeKey}:${state.hotelId}:${fullHotel ? "page" : "panel"}:${state.factId ?? state.placeId ?? "hotel"}`,
    state.detailRef,
  )
  const move = (action: () => void) => {
    if (modality.instant) action()
    else void withViewTransition("layout", action)
  }
  const select: typeof state.select = (result) => move(() => state.select(result))
  const start = state.surface === "landing"
  const mapVisible = useMapVisible(state.surface, state.view)
  const send = (message: string) => {
    if (modality.instant) state.send(message)
    else void withViewTransition("layout", () => state.send(message))
  }
  const sizes = {
    ...(panelSize.width ? { "--panel-width": `${panelSize.width}px` } : {}),
  } as CSSProperties
  return (
    <HotelStayProvider scopeKey={state.navigation.scopeKey} stay={state.search?.parsed}>
      {start ? (
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
      ) : null}
      <div
        className={styles.page}
        data-surface={state.surface}
        data-standalone={standalone}
        data-chrome={standalone ? "bare" : undefined}
        hidden={start}
      >
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
          data-docked={docked}
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
            <WorkspaceChat
              docked={docked}
              open={dockOpen}
              onOpenChange={setDockOpen}
              chat={{
                draftKey: `chat:${state.navigation.scopeKey}`,
                messages: state.messages,
                conversationId: state.conversationId,
                history: state.history,
                search: state.search,
                searchMessageId: state.searchMessageId,
                outgoing: state.outgoing,
                selectedHotel: selected?.hotel.name,
                loading: state.chatLoading,
                sending: state.sending,
                failed: state.chatFailed,
                onSend: state.send,
                onRetry: state.retry,
                onShowOnMap: state.showOnMap,
                onShowList: () => state.setView("hotels"),
                onReset: () => state.reset(),
                onOpenConversation: state.openConversation,
                view: chatView,
                onView: setChatView,
                onRename: state.renameConversation,
                onDelete: state.deleteConversation,
              }}
            />
          )}
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

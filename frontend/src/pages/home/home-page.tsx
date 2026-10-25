import type { CSSProperties } from "react"
import { FactDetails } from "@/features/fact-details"
import { HotelDetails } from "@/features/hotel-details"
import { HotelMap } from "@/features/hotel-map"
import { useHotelWorkspace, type WorkspaceView } from "@/features/hotel-search"
import { SearchChat } from "@/features/search-chat"
import { SearchResults } from "@/features/search-results"
import { useResizable } from "@/shared/hooks"
import { useDocumentTitle, useTranslation } from "@/shared/i18n"
import { Swap, usePresence } from "@/shared/motion"
import { Button, ButtonLink, ResizeHandle, ScrollArea, Segmented } from "@/shared/ui"
import styles from "./home-page.module.css"

export function HomePage() {
  const { t } = useTranslation()
  useDocumentTitle(null)
  const state = useHotelWorkspace()
  const selected = state.results.find((item) => item.hotel.id === state.hotelId)
  const compareQuery = new URLSearchParams(state.compared.map((id) => ["hotel", id])).toString()
  const compareDock = usePresence(state.compared.length >= 2)
  const limitDock = usePresence(state.limitReached)
  const panelSize = useResizable({
    storageKey: "factmap-panel-width",
    edge: "end",
    initial: "--workspace-panel",
    min: "--workspace-panel-min",
    max: "--workspace-panel-max",
  })
  const chatSize = useResizable({
    storageKey: "factmap-chat-width",
    edge: "start",
    initial: "--workspace-chat",
    min: "--workspace-panel-min",
    max: "--workspace-panel-max",
  })
  const sizes = {
    ...(panelSize.width ? { "--panel-width": `${panelSize.width}px` } : {}),
    ...(chatSize.width ? { "--chat-width": `${chatSize.width}px` } : {}),
  } as CSSProperties
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
      <div className={styles.workspace} data-view={state.view} style={sizes}>
        <aside className={styles.panel} aria-label={t("explore:panel.title")}>
          <ResizeHandle
            label={t("explore:panel.resizePanel")}
            edge="end"
            current={panelSize.width ?? panelSize.min}
            resizable={panelSize}
          />
          <Swap swapKey={state.hotelId ? "hotel" : "list"} as="div" className={styles.swap}>
            {state.hotelId ? (
              <SelectedHotel state={state} />
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
            regionId="sochi"
            results={state.results}
            bounds={state.bounds}
            onSelect={state.select}
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
            outgoing={state.outgoing}
            selectedHotel={selected?.hotel.name}
            loading={state.chatLoading}
            sending={state.sending}
            failed={state.chatFailed}
            onSend={state.send}
            onRetry={state.retry}
            onShowOnMap={state.showOnMap}
            onShowList={() => state.setView("hotels")}
            onReset={state.reset}
            onOpenConversation={state.openConversation}
          />
        </div>
      </div>
      {compareDock.mounted ? (
        <div
          className={styles.compare}
          data-state={compareDock.state}
          onAnimationEnd={compareDock.onAnimationEnd}
        >
          <ButtonLink to={`/compare?${compareQuery}`} icon="compare">
            {t("explore:navigation.compare")} ({state.compared.length})
          </ButtonLink>
        </div>
      ) : null}
      {limitDock.mounted ? (
        <p
          className={styles.status}
          role="status"
          data-state={limitDock.state}
          onAnimationEnd={limitDock.onAnimationEnd}
        >
          {t("explore:results.selectionLimit")}
        </p>
      ) : null}
    </div>
  )
}

type Workspace = ReturnType<typeof useHotelWorkspace>

function SelectedHotel({ state }: { readonly state: Workspace }) {
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
        <Swap swapKey={state.factId ?? hotelId} as="div">
          {state.factId ? (
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

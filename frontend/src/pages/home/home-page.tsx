import { FactDetails } from "@/features/fact-details"
import { HotelDetails } from "@/features/hotel-details"
import { HotelMap } from "@/features/hotel-map"
import { useHotelWorkspace, type WorkspaceView } from "@/features/hotel-search"
import { SearchChat } from "@/features/search-chat"
import { SearchResults } from "@/features/search-results"
import { useDocumentTitle, useTranslation } from "@/shared/i18n"
import { Swap, usePresence } from "@/shared/motion"
import { Button, ButtonLink, ScrollArea, Segmented } from "@/shared/ui"
import styles from "./home-page.module.css"

export function HomePage() {
  const { t } = useTranslation()
  useDocumentTitle(null)
  const state = useHotelWorkspace()
  const selected = state.results.find((item) => item.hotel.id === state.hotelId)
  const compareQuery = new URLSearchParams(state.compared.map((id) => ["hotel", id])).toString()
  const compared = state.hotelId !== undefined && state.compared.includes(state.hotelId)
  const compareDock = usePresence(state.compared.length >= 2)
  const limitDock = usePresence(state.limitReached)
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
      <div className={styles.workspace} data-view={state.view}>
        <aside className={styles.panel} aria-label={t("explore:panel.title")}>
          <Swap swapKey={state.hotelId ? "hotel" : "list"} as="div" className={styles.swap}>
            {state.hotelId ? (
              <>
                <div className={styles.bar}>
                  <Button
                    variant="ghost"
                    size="compact"
                    icon="chevron-left"
                    onClick={state.closeHotel}
                  >
                    {t("explore:panel.back")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="compact"
                    icon="compare"
                    aria-pressed={compared}
                    onClick={() => state.hotelId && state.compare(state.hotelId)}
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
                  <Swap swapKey={state.factId ?? state.hotelId} as="div">
                    {state.factId ? (
                      <FactDetails
                        hotelId={state.hotelId}
                        factId={state.factId}
                        onBack={state.closeFact}
                      />
                    ) : (
                      <HotelDetails
                        hotelId={state.hotelId}
                        matched={selected?.matched ?? []}
                        onProperty={(item) => selected && state.property(selected, item)}
                        onFact={state.fact}
                        onPreview={(item) => selected && state.preview(selected, item)}
                      />
                    )}
                  </Swap>
                </ScrollArea>
              </>
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
          <SearchChat
            messages={state.messages}
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

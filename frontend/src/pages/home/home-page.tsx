import { FactDetails } from "@/features/fact-details"
import { HotelChat } from "@/features/hotel-chat"
import { HotelDetails } from "@/features/hotel-details"
import { HotelMap } from "@/features/hotel-map"
import { useHotelWorkspace } from "@/features/hotel-search"
import { SearchResults } from "@/features/search-results"
import { useDocumentTitle, useTranslation } from "@/shared/i18n"
import { ButtonLink, PageHeader, ScrollArea, Segmented } from "@/shared/ui"
import styles from "./home-page.module.css"
export function HomePage() {
  const { t } = useTranslation()
  useDocumentTitle(null)
  const state = useHotelWorkspace()
  const selected = state.results.find((item) => item.hotel.id === state.hotelId)
  const compareQuery = new URLSearchParams(state.compared.map((id) => ["hotel", id])).toString()
  return (
    <div className={styles.page}>
      <PageHeader title={t("explore:title")} />
      <div className={styles.mobileSwitch}>
        <Segmented
          label={t("explore:map.title")}
          display="short"
          options={[
            { value: "list", label: t("explore:map.list"), short: t("explore:map.list") },
            { value: "map", label: t("explore:map.map"), short: t("explore:map.map") },
            { value: "chat", label: t("explore:chat.title"), short: t("explore:chat.short") },
          ]}
          value={state.view}
          onChange={state.setView}
        />
      </div>
      <div className={styles.workspace} data-view={state.view}>
        <aside className={styles.sidebar}>
          <ScrollArea className={styles.sidebarScroll}>
            <aside
              className={styles.details}
              ref={state.detailRef}
              tabIndex={-1}
              aria-label={t("explore:details.title")}
            >
              {state.hotelId && state.factId ? (
                <FactDetails
                  hotelId={state.hotelId}
                  factId={state.factId}
                  onBack={state.closeFact}
                />
              ) : state.hotelId ? (
                <HotelDetails
                  hotelId={state.hotelId}
                  matched={selected?.matched ?? []}
                  onProperty={(item) => {
                    if (selected) state.property(selected, item)
                  }}
                  onFact={state.fact}
                  onPreview={(item) => {
                    if (selected) state.preview(selected, item)
                  }}
                />
              ) : null}
            </aside>
            <SearchResults
              response={state.search ?? null}
              pending={state.pending}
              hotelId={state.hotelId}
              compared={state.compared}
              onSelect={state.select}
              onProperty={state.property}
              onCompare={state.compare}
              onPreview={state.preview}
            />
          </ScrollArea>
        </aside>
        <div className={styles.canvasColumn}>
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
        <aside className={styles.chatColumn}>
          <HotelChat
            messages={state.messages}
            selectedHotel={selected?.hotel.name}
            pending={state.pending}
            error={state.chatError}
            onSend={state.send}
          />
        </aside>
      </div>
      {state.compared.length >= 2 ? (
        <div className={styles.compare}>
          <ButtonLink to={`/compare?${compareQuery}`} icon="compare">
            {t("explore:navigation.compare")} ({state.compared.length})
          </ButtonLink>
        </div>
      ) : null}
      {state.limitReached ? <p role="status">{t("explore:results.selectionLimit")}</p> : null}
    </div>
  )
}

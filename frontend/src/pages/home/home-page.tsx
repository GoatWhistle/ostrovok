import { FactDetails } from "@/features/fact-details"
import { HotelDetails } from "@/features/hotel-details"
import { HotelMap } from "@/features/hotel-map"
import { HotelSearch, useHotelWorkspace } from "@/features/hotel-search"
import { SearchResults } from "@/features/search-results"
import { useDocumentTitle, useTranslation } from "@/shared/i18n"
import { ButtonLink, Segmented } from "@/shared/ui"
import styles from "./home-page.module.css"
export function HomePage() {
  const { t } = useTranslation()
  useDocumentTitle(null)
  const state = useHotelWorkspace()
  const selected = state.results.find((item) => item.hotel.id === state.hotelId)
  const compareQuery = new URLSearchParams(state.compared.map((id) => ["hotel", id])).toString()
  return (
    <div className={styles.page}>
      <div className={styles.mobileSwitch}>
        <Segmented
          label={t("explore:map.title")}
          options={[
            { value: "list", label: t("explore:map.list"), icon: "list" },
            { value: "map", label: t("explore:map.map"), icon: "map" },
          ]}
          value={state.view}
          onChange={state.setView}
        />
      </div>
      <div className={styles.workspace} data-view={state.view}>
        <aside className={styles.sidebar}>
          <HotelSearch onSearch={state.submit} pending={state.pending} />
          <SearchResults
            request={state.request}
            hotelId={state.hotelId}
            compared={state.compared}
            onSelect={state.select}
            onProperty={state.property}
            onCompare={state.compare}
            onPreview={state.preview}
          />
        </aside>
        <div className={styles.canvasColumn} data-selected={state.hotelId !== undefined}>
          <HotelMap
            hotelId={state.hotelId}
            camera={state.camera}
            geoRefs={state.geoRefs}
            focusedFact={state.focusedFact}
            focusProperty={state.focusProperty}
            regionId={state.request?.region_id ?? undefined}
            results={state.results}
            bounds={state.bounds}
            onSelect={state.select}
          />
          <aside
            className={styles.details}
            ref={state.detailRef}
            tabIndex={-1}
            aria-label={t("explore:details.title")}
          >
            {state.hotelId && state.factId ? (
              <FactDetails hotelId={state.hotelId} factId={state.factId} onBack={state.closeFact} />
            ) : (
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
            )}
          </aside>
        </div>
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

import type { SearchJourney } from "@/shared/api/search-journey"
import type { SearchPreview } from "@/shared/api/search-preview"
import { type MessageKey, useTranslation } from "@/shared/i18n"
import { Button, Icon } from "@/shared/ui"
import { SearchSceneCopy } from "./search-scene-copy"
import styles from "./search-status.module.css"

const labels: Readonly<Record<string, MessageKey>> = {
  locating: "explore:searchMap.locating",
  searching: "explore:searchMap.searching",
  checking: "explore:searchMap.checking",
  city: "explore:searchMap.city",
  unresolved: "explore:searchMap.unresolved",
  empty: "explore:searchMap.empty",
  error: "explore:searchMap.error",
}
export function SearchStatus({
  journey,
  scene,
  onRetry,
}: {
  readonly scene: SearchPreview | undefined
  readonly journey: SearchJourney
  readonly onRetry: () => void
}) {
  const { t } = useTranslation()
  const key = labels[journey.status]
  const visiting = journey.winner ? undefined : scene
  if (!key && !visiting) return null
  return (
    <div className={styles.position}>
      <div
        className={styles.status}
        data-map-obstacle
        data-search-status={journey.status}
        data-search-hotel={visiting?.id}
      >
        <Icon name="map" size="sm" />
        <div role="status" aria-live="polite">
          <strong>
            {visiting
              ? t("explore:searchMap.visiting", { name: visiting.name })
              : key
                ? t(key, { location: journey.location ?? "" })
                : null}
          </strong>
          {visiting ? <SearchSceneCopy scene={visiting} journey={journey} /> : null}
          {journey.status === "checking" && !visiting ? (
            <p>{t("explore:searchMap.pending")}</p>
          ) : null}
        </div>
        {journey.status === "error" || journey.status === "unresolved" ? (
          <Button size="compact" onClick={onRetry}>
            {t("explore:searchMap.retry")}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

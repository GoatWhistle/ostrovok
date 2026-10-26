import { useTranslation } from "@/shared/i18n"
import { usePresence } from "@/shared/motion"
import { Banner, ButtonLink } from "@/shared/ui"
import styles from "./compare-dock.module.css"

export function CompareDock({
  ids,
  limit,
}: {
  readonly ids: readonly string[]
  readonly limit: boolean
}) {
  const { t } = useTranslation()
  const presence = usePresence(ids.length >= 2)
  const query = new URLSearchParams(ids.map((id) => ["hotel", id])).toString()
  if (!presence.mounted) return null
  return (
    <div
      className={styles.dock}
      data-state={presence.state}
      onAnimationEnd={presence.onAnimationEnd}
    >
      {limit ? <Banner tone="neutral" title={t("explore:results.selectionLimit")} /> : null}
      <ButtonLink to={`/compare?${query}`} icon="compare">
        {t("explore:navigation.compare")} ({ids.length})
      </ButtonLink>
    </div>
  )
}

import type { SearchResult } from "@/shared/api/hotel-types"
import type { components } from "@/shared/api/schema.gen"
import { characteristicTitle } from "@/shared/geo/fact-label"
import { useLocale, useTranslation } from "@/shared/i18n"
import {
  Banner,
  Button,
  Chip,
  characteristicHue,
  characteristicIcon,
  StatusBadge,
} from "@/shared/ui"
import styles from "./agent-reply.module.css"

export type SearchResponse = components["schemas"]["SearchResponse"]
type Parsed = SearchResponse["parsed"]

export function ReplyIntents({ parsed }: { readonly parsed: Parsed }) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  if (!parsed.intents?.length) return null
  return (
    <div className={styles.group}>
      <p className={styles.caption}>{t("explore:chat.understood")}</p>
      <div className={styles.chips}>
        {parsed.intents.map((intent) => {
          const key = intent.characteristic_key ?? ""
          return (
            <Chip
              key={`${key}:${intent.source_text ?? ""}`}
              static
              pressed
              icon={characteristicIcon(key)}
              hue={characteristicHue(key)}
              label={intent.source_text ?? characteristicTitle(key, locale)}
            />
          )
        })}
      </div>
    </div>
  )
}

export function ReplyNotices({
  parsed,
  pending,
}: {
  readonly parsed: Parsed
  readonly pending: boolean
}) {
  const { t } = useTranslation()
  const unmatched = parsed.unmatched_terms ?? []
  return (
    <>
      {parsed.corrections?.map((item) => (
        <Banner
          key={`${item.original}:${item.corrected}`}
          tone="info"
          title={t("explore:results.corrections")}
        >
          {t("explore:results.correction", item)}
        </Banner>
      ))}
      {parsed.needs_clarification ? (
        <Banner tone="warning" title={t("explore:chat.clarify")}>
          {t("explore:results.clarification")}
        </Banner>
      ) : null}
      {parsed.unsupported_region ? (
        <Banner tone="neutral" title={t("explore:results.corrections")}>
          {t("explore:results.unsupportedRegion", { region: parsed.unsupported_region })}
        </Banner>
      ) : null}
      {unmatched.length || pending ? (
        <div className={styles.chips}>
          {unmatched.length ? (
            <StatusBadge tone="warning" icon="unknown">
              {t("explore:chat.unmatched", { terms: unmatched.join(", ") })}
            </StatusBadge>
          ) : null}
          {pending ? (
            <StatusBadge tone="info" icon="pending">
              {t("explore:chat.pending")}
            </StatusBadge>
          ) : null}
        </div>
      ) : null}
    </>
  )
}

export interface ReplyActionsProps {
  readonly leading: SearchResult | undefined
  readonly onShowOnMap: (result: SearchResult | undefined) => void
  readonly onShowList: () => void
}

export function ReplyActions({ leading, onShowOnMap, onShowList }: ReplyActionsProps) {
  const { t } = useTranslation()
  return (
    <div className={styles.actions}>
      <Button variant="fact" size="compact" icon="map" onClick={() => onShowOnMap(leading)}>
        {t("explore:chat.showOnMap")}
      </Button>
      <Button
        variant="ghost"
        size="compact"
        icon="list"
        className={styles.narrowOnly}
        onClick={onShowList}
      >
        {t("explore:chat.showList")}
      </Button>
    </div>
  )
}

import type { FactBrief } from "@/shared/api/hotel-types"
import type { components } from "@/shared/api/schema.gen"
import { sourceUrl } from "@/shared/api/source-url"
import { useFormatters, useTranslation } from "@/shared/i18n"
import { Confidence, Disclosure, Icon } from "@/shared/ui"
import styles from "./fact-provenance.module.css"

type Provenance = components["schemas"]["Provenance"]
type Conflict = components["schemas"]["Conflict"]

export interface FactProvenanceProps {
  readonly provenance: Provenance
  readonly conflicts: readonly Conflict[]
  readonly fact?: Pick<FactBrief, "source_type" | "confidence">
}

function validDate(value: string | null | undefined): string | undefined {
  return value && Number.isFinite(Date.parse(value)) ? value : undefined
}

function TechnicalDetails({
  provenance,
  conflicts,
}: Pick<FactProvenanceProps, "provenance" | "conflicts">) {
  const { t } = useTranslation()
  const rules = [...new Set(conflicts.flatMap((item) => (item.rule ? [item.rule] : [])))]
  const rows = [
    { label: t("explore:details.method"), value: provenance.method },
    { label: t("explore:details.reference"), value: provenance.source_ref },
    { label: t("explore:details.conflictRule"), value: rules.join(", ") },
  ].filter((row) => row.value)
  if (!rows.length) return null
  return (
    <Disclosure title={t("explore:details.technical")}>
      <dl className={styles.technical}>
        {rows.map(({ label, value }) => (
          <div className={styles.row} key={label}>
            <dt>{label}</dt>
            <dd>
              <code>{value}</code>
            </dd>
          </div>
        ))}
      </dl>
    </Disclosure>
  )
}

export function FactProvenance({ provenance, conflicts, fact }: FactProvenanceProps) {
  const { t } = useTranslation()
  const format = useFormatters()
  const dates = [
    { label: t("explore:details.checked"), value: validDate(provenance.computed_at) },
    { label: t("explore:details.observed"), value: validDate(provenance.observed_at) },
    { label: t("explore:details.validUntil"), value: validDate(provenance.valid_until) },
  ].filter((entry): entry is { label: string; value: string } => entry.value !== undefined)
  const link = sourceUrl(provenance.source_url)
  const sourceRepeated = fact?.source_type === provenance.source_type
  const confidenceRepeated = fact?.confidence === provenance.confidence
  return (
    <div className={styles.provenance}>
      {dates.length || !sourceRepeated || !confidenceRepeated ? (
        <dl className={styles.list}>
          {sourceRepeated ? null : (
            <div className={styles.row}>
              <dt>{t("explore:details.source")}</dt>
              <dd>{t(`explore:source.${provenance.source_type}`)}</dd>
            </div>
          )}
          {confidenceRepeated ? null : (
            <div className={styles.row}>
              <dt>{t(fact ? "explore:details.sourceConfidence" : "explore:details.confidence")}</dt>
              <dd>
                <Confidence value={provenance.confidence} />
              </dd>
            </div>
          )}
          {dates.map(({ label, value }) => (
            <div className={styles.row} key={label}>
              <dt>{label}</dt>
              <dd>
                <time dateTime={value}>{format.date(value)}</time>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {provenance.evidence?.length ? (
        <div className={styles.evidence}>
          <p className={styles.label}>{t("explore:details.evidence")}</p>
          {provenance.evidence.map((item) => (
            <blockquote className={styles.quote} key={`${item.kind}-${item.text}`} lang="ru">
              {item.text}
            </blockquote>
          ))}
        </div>
      ) : null}
      {link ? (
        <a className={styles.link} href={link} target="_blank" rel="noreferrer noopener">
          <Icon name="external" size="sm" />
          {t("explore:details.openSource")}
        </a>
      ) : null}
      <TechnicalDetails provenance={provenance} conflicts={conflicts} />
    </div>
  )
}

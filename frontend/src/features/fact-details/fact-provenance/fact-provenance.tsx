import { sourceIcon } from "@/entities/evidence"
import type { components } from "@/shared/api/schema.gen"
import { sourceUrl } from "@/shared/api/source-url"
import { useFormatters, useTranslation } from "@/shared/i18n"
import { Confidence, Icon, NoValue } from "@/shared/ui"
import styles from "./fact-provenance.module.css"

type Provenance = components["schemas"]["Provenance"]
type Conflict = components["schemas"]["Conflict"]

export interface FactProvenanceProps {
  readonly provenance: Provenance
  readonly conflicts: readonly Conflict[]
}

function validDate(value: string | null | undefined): string | undefined {
  return value && Number.isFinite(Date.parse(value)) ? value : undefined
}

export function FactProvenance({ provenance, conflicts }: FactProvenanceProps) {
  const { t } = useTranslation()
  const format = useFormatters()
  const date = (value: string | null | undefined) => {
    const valid = validDate(value)
    return valid ? format.date(valid) : <NoValue />
  }
  const link = sourceUrl(provenance.source_url)
  const rules = [...new Set(conflicts.flatMap((item) => (item.rule ? [item.rule] : [])))]
  return (
    <div className={styles.provenance}>
      <dl className={styles.list}>
        <dt>
          <Icon name={sourceIcon(provenance.source_type)} size="sm" />
          {t("explore:details.source")}
        </dt>
        <dd>{t(`explore:source.${provenance.source_type}`)}</dd>
        <dt>
          <Icon name="info" size="sm" />
          {t("explore:details.confidence")}
        </dt>
        <dd>
          <Confidence value={provenance.confidence} />
        </dd>
        {provenance.method ? (
          <>
            <dt>
              <Icon name="computed" size="sm" />
              {t("explore:details.method")}
            </dt>
            <dd className={styles.mono}>{provenance.method}</dd>
          </>
        ) : null}
        <dt>
          <Icon name="history" size="sm" />
          {t("explore:details.checked")}
        </dt>
        <dd className={styles.mono}>{date(provenance.computed_at)}</dd>
        <dt>
          <Icon name="calendar" size="sm" />
          {t("explore:details.observed")}
        </dt>
        <dd className={styles.mono}>{date(provenance.observed_at)}</dd>
        <dt>
          <Icon name="pending" size="sm" />
          {t("explore:details.validUntil")}
        </dt>
        <dd className={styles.mono}>{date(provenance.valid_until)}</dd>
        {provenance.source_ref ? (
          <>
            <dt>
              <Icon name="source" size="sm" />
              {t("explore:details.reference")}
            </dt>
            <dd className={styles.mono}>{provenance.source_ref}</dd>
          </>
        ) : null}
        {rules.length ? (
          <>
            <dt>
              <Icon name="alert" size="sm" />
              {t("explore:details.conflictRule")}
            </dt>
            <dd className={styles.mono}>{rules.join(", ")}</dd>
          </>
        ) : null}
      </dl>
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
        <a className={styles.link} href={link} target="_blank" rel="noreferrer">
          <Icon name="share" size="sm" />
          {t("explore:details.openSource")}
        </a>
      ) : null}
    </div>
  )
}

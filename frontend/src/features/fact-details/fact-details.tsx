import { useFact } from "@/entities/hotel"
import { sourceUrl } from "@/shared/api/source-url"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Button, Card, ErrorState, Skeleton } from "@/shared/ui"
import { FactCorrection } from "./fact-correction"
import styles from "./fact-details.module.css"

function formatDate(value: string | null | undefined, locale: string, unknown: string) {
  return value && Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(value))
    : unknown
}

export interface FactDetailsProps {
  readonly hotelId: string
  readonly factId: string
  readonly onBack: () => void
  readonly review?: boolean
}
export function FactDetails({ hotelId, factId, onBack, review = false }: FactDetailsProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const query = useFact(hotelId, factId)
  const date = (value: string | null | undefined) =>
    formatDate(value, locale, t("explore:details.unknown"))
  return (
    <section className={styles.detail}>
      <Button icon="back" variant="ghost" onClick={onBack}>
        {t("explore:details.back")}
      </Button>
      {query.isPending ? <Skeleton /> : null}
      {query.isError ? (
        <ErrorState title={t("explore:details.factError")} onRetry={() => void query.refetch()} />
      ) : null}
      {query.data ? (
        <Card title={query.data.label} description={query.data.explanation}>
          <p className={styles.status}>{t(`explore:status.${query.data.status}`)}</p>
          {query.data.provenance ? (
            <dl className={styles.provenance}>
              <dt>{t("explore:details.source")}</dt>
              <dd>{t(`explore:source.${query.data.provenance.source_type}`)}</dd>
              <dt>{t("explore:details.confidence")}</dt>
              <dd>
                {new Intl.NumberFormat(locale, {
                  style: "percent",
                  maximumFractionDigits: 0,
                }).format(query.data.provenance.confidence)}
              </dd>
              <dt>{t("explore:details.checked")}</dt>
              <dd>{date(query.data.provenance.computed_at)}</dd>
              <dt>{t("explore:details.observed")}</dt>
              <dd>{date(query.data.provenance.observed_at)}</dd>
              <dt>{t("explore:details.validUntil")}</dt>
              <dd>{date(query.data.provenance.valid_until)}</dd>
              {query.data.provenance.method ? (
                <>
                  <dt>{t("explore:details.method")}</dt>
                  <dd>{query.data.provenance.method}</dd>
                </>
              ) : null}
            </dl>
          ) : null}
          <SourceLink url={query.data.provenance?.source_url} />
          {query.data.provenance?.evidence?.map((item) => (
            <blockquote className={styles.evidence} key={`${item.kind}-${item.text}`}>
              {item.text}
            </blockquote>
          ))}
          {query.data.conflicts?.length ? (
            <p className={styles.status}>{t("explore:details.conflicts")}</p>
          ) : null}
          {query.data.history?.length ? (
            <div className={styles.history}>
              <p>{t("explore:details.history")}</p>
              {query.data.history.map((fact) => (
                <p key={fact.fact_id}>
                  {fact.label}: {t(`explore:status.${fact.status}`)}
                </p>
              ))}
            </div>
          ) : null}
          {review ? <FactCorrection fact={query.data} /> : null}
        </Card>
      ) : null}
    </section>
  )
}

function SourceLink({ url }: { readonly url: string | null | undefined }) {
  const { t } = useTranslation()
  const safe = sourceUrl(url)
  return safe ? (
    <a className={styles.link} href={safe} target="_blank" rel="noreferrer">
      {t("explore:details.source")}
    </a>
  ) : null
}

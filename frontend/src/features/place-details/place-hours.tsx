import { isOpen, parseOpeningHours } from "@/entities/place"
import { useLocale, useTranslation } from "@/shared/i18n"
import styles from "./place-details.module.css"

export interface PlaceHoursProps {
  readonly value: string | undefined
  readonly date: string
  readonly hour: number
}

function clock(minutes: number) {
  const value = minutes % 1440
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`
}

export function PlaceHours({ value, date, hour }: PlaceHoursProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  if (!value) return <p>{t("explore:place.noHours")}</p>
  const rules = parseOpeningHours(value)
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" })
  return (
    <>
      <p className={styles.raw}>{value}</p>
      {rules ? (
        <>
          <strong>
            {t(isOpen(rules, date, hour) ? "explore:place.open" : "explore:place.closed")}
          </strong>
          <p className={styles.meta}>
            {t("explore:place.atTime", { date, hour: String(hour).padStart(2, "0") })}
          </p>
          <ul className={styles.schedule}>
            {rules.map((rule) => (
              <li key={JSON.stringify(rule)}>
                <span>
                  {rule.days
                    .map((day) => weekday.format(new Date(Date.UTC(2026, 0, 4 + day))))
                    .join(", ")}
                </span>
                <span>
                  {rule.intervals.length
                    ? rule.intervals
                        .map(([start, end]) =>
                          t("explore:place.interval", {
                            start: clock(start),
                            end: end === 1440 ? "24:00" : clock(end),
                            next: end > 1440 ? t("explore:place.nextDay") : "",
                          }),
                        )
                        .join(", ")
                    : t("explore:place.dayOff")}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>{t("explore:place.unparsed")}</p>
      )}
    </>
  )
}

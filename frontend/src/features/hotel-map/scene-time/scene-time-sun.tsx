import type { CSSProperties } from "react"
import type { components } from "@/shared/api/schema.gen"
import type { Locale } from "@/shared/i18n"
import { useLocale, useTranslation } from "@/shared/i18n"
import { i18n } from "@/shared/i18n/instance"
import { Icon, NoValue } from "@/shared/ui"
import { localClock, weatherDescription } from "./scene-time"
import styles from "./scene-time-panel.module.css"

type Weather = components["schemas"]["Weather"]

function available(weather: Weather | undefined) {
  const temperature = weather?.temperature_c
  const code = weather?.weather_code
  return weather?.status === "available" &&
    typeof temperature === "number" &&
    typeof code === "number"
    ? { temperature, code }
    : undefined
}

export function weatherText(weather: Weather | undefined, pending: boolean, locale: Locale) {
  const data = available(weather)
  if (data)
    return i18n.t("explore:weather.summary", {
      lng: locale,
      temperature: Math.round(data.temperature),
      condition: weatherDescription(data.code, locale),
    })
  return i18n.t(pending ? "explore:weather.loading" : "explore:weather.unavailable", {
    lng: locale,
  })
}

export function SunFacts({
  altitude,
  azimuth,
  sunset,
}: {
  readonly altitude: number
  readonly azimuth: number
  readonly sunset: Date | null
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const sunsetTime = localClock(sunset, locale)
  return (
    <div className={styles.sun}>
      <div
        className={styles.compass}
        role="img"
        aria-label={t("explore:weather.direction", { azimuth: Math.round(azimuth) })}
      >
        <span
          className={styles.needle}
          data-below={altitude < 0}
          style={{ "--sun-azimuth": `${azimuth}deg` } as CSSProperties}
        >
          <Icon name="theme-light" size="sm" />
        </span>
      </div>
      <dl className={styles.stats} aria-live="polite">
        <div className={styles.stat}>
          <dt className={styles.statLabel}>{t("explore:weather.altitude")}</dt>
          <dd className={styles.statValue}>
            {t("explore:weather.degrees", { value: Math.round(altitude) })}
          </dd>
        </div>
        <div className={styles.stat}>
          <dt className={styles.statLabel}>{t("explore:weather.azimuth")}</dt>
          <dd className={styles.statValue}>
            {t("explore:weather.degrees", { value: Math.round(azimuth) })}
          </dd>
        </div>
        <div className={styles.stat}>
          <dt className={styles.statLabel}>{t("explore:weather.sunsetShort")}</dt>
          <dd className={styles.statValue}>{sunsetTime ?? <NoValue />}</dd>
        </div>
      </dl>
    </div>
  )
}

import { type CSSProperties, useState } from "react"
import type { components } from "@/shared/api/schema.gen"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Button, Icon } from "@/shared/ui"
import styles from "./hotel-map.module.css"
import { localClock, weatherDescription } from "./scene-time"

type Weather = components["schemas"]["Weather"]

interface SceneTimePanelProps {
  readonly date: string
  readonly minDate: string
  readonly maxDate: string
  readonly hour: number
  readonly altitude: number
  readonly azimuth: number
  readonly sunset: Date | null
  readonly weather: Weather | undefined
  readonly weatherPending: boolean
  readonly onDate: (value: string) => void
  readonly onHour: (value: number) => void
  readonly onOverview: () => void
}

export function SceneTimePanel({
  date,
  minDate,
  maxDate,
  hour,
  altitude,
  azimuth,
  sunset,
  weather,
  weatherPending,
  onDate,
  onHour,
  onOverview,
}: SceneTimePanelProps) {
  const [expanded, setExpanded] = useState(false)
  const { t } = useTranslation()
  const { locale } = useLocale()
  const sunsetTime = localClock(sunset, locale)
  const temperature = weather?.temperature_c
  const code = weather?.weather_code
  const weatherText =
    weather?.status === "available" && typeof temperature === "number" && typeof code === "number"
      ? t("explore:weather.summary", {
          temperature: Math.round(temperature),
          condition: weatherDescription(code, locale),
        })
      : weatherPending
        ? t("explore:weather.loading")
        : t("explore:weather.unavailable")
  return (
    <div className={styles.timePanel} data-expanded={expanded}>
      <div className={styles.timeHeading}>
        <Button
          variant="ghost"
          icon="sunset"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {t("explore:weather.scene")}
        </Button>
        {expanded ? (
          <Button
            variant="ghost"
            icon="locate"
            onClick={onOverview}
            className={styles.overviewButton}
          >
            {t("explore:map.overview")}
          </Button>
        ) : (
          <span className={styles.weatherCompact}>{weatherText}</span>
        )}
      </div>
      {expanded ? (
        <div className={styles.timeFields}>
          <label>
            <span>{t("explore:weather.date")}</span>
            <input
              type="date"
              value={date}
              min={minDate}
              max={maxDate}
              onChange={(event) => onDate(event.target.value)}
            />
          </label>
          <label>
            <span>{t("explore:weather.time")}</span>
            <input
              type="time"
              step="3600"
              value={`${String(hour).padStart(2, "0")}:00`}
              onChange={(event) => onHour(Number(event.target.value.slice(0, 2)))}
            />
          </label>
        </div>
      ) : null}
      {expanded ? (
        <div className={styles.sunWeatherRow}>
          <div className={styles.timeFacts} aria-live="polite">
            <span>
              {altitude >= 0
                ? t("explore:weather.sunAbove", {
                    altitude: Math.round(altitude),
                    azimuth: Math.round(azimuth),
                  })
                : t("explore:weather.sunBelow")}
            </span>
            {sunsetTime ? <span>{t("explore:weather.sunset", { time: sunsetTime })}</span> : null}
            <span>{weatherText}</span>
          </div>
          <div
            className={styles.sunCompass}
            role="img"
            aria-label={t("explore:weather.direction", { azimuth: Math.round(azimuth) })}
          >
            <span
              className={styles.sunNeedle}
              style={{ "--sun-azimuth": `${azimuth}deg` } as CSSProperties}
            >
              <Icon name="sunset" size="sm" />
            </span>
          </div>
        </div>
      ) : null}
    </div>
  )
}

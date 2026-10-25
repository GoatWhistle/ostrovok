import { useState } from "react"
import type { components } from "@/shared/api/schema.gen"
import { useLocale, useTranslation } from "@/shared/i18n"
import { usePresence } from "@/shared/motion"
import { Button } from "@/shared/ui"
import { zoneHour } from "./scene-time"
import { DateStepper, HourStepper } from "./scene-time-fields"
import styles from "./scene-time-panel.module.css"
import { SunFacts, WeatherBadge, weatherText } from "./scene-time-sun"

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
}: SceneTimePanelProps) {
  const [expanded, setExpanded] = useState(false)
  const { t } = useTranslation()
  const { locale } = useLocale()
  const sunsetHour = zoneHour(sunset)
  const body = usePresence(expanded)
  return (
    <section
      className={styles.panel}
      data-expanded={body.mounted}
      aria-label={t("explore:weather.scene")}
    >
      <div className={styles.heading}>
        <Button
          variant="ghost"
          icon="sunset"
          className={styles.toggle}
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {t("explore:weather.scene")}
        </Button>
        {body.mounted ? null : (
          <span className={styles.summary}>{weatherText(weather, weatherPending, locale)}</span>
        )}
      </div>
      {body.mounted ? (
        <div className={styles.body} data-state={body.state} onAnimationEnd={body.onAnimationEnd}>
          <div className={styles.fields}>
            <DateStepper date={date} minDate={minDate} maxDate={maxDate} onDate={onDate} />
            <HourStepper hour={hour} onHour={onHour} />
          </div>
          <SunFacts altitude={altitude} azimuth={azimuth} sunset={sunset} />
          <div className={styles.footer}>
            <WeatherBadge weather={weather} pending={weatherPending} />
            {sunsetHour === null ? null : (
              <Button
                variant="outline"
                size="compact"
                icon="sunset"
                disabled={sunsetHour === hour}
                onClick={() => onHour(sunsetHour)}
              >
                {t("explore:weather.atSunset")}
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}

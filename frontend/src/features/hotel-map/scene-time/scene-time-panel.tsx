import type { components } from "@/shared/api/schema.gen"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Button, Popover } from "@/shared/ui"
import { zoneHour } from "./scene-time"
import { DateStepper, HourStepper } from "./scene-time-fields"
import styles from "./scene-time-panel.module.css"
import { SunFacts, weatherText } from "./scene-time-sun"
import { weatherIcon } from "./weather-icon"

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
  const { t } = useTranslation()
  const { locale } = useLocale()
  const sunsetHour = zoneHour(sunset)
  return (
    <Popover
      label={`${t("explore:weather.scene")}: ${weatherText(weather, weatherPending, locale)}`}
      icon={weatherIcon(
        weather?.status === "available" ? weather.weather_code : undefined,
        altitude,
      )}
      summary={
        weather?.status === "available" && typeof weather.temperature_c === "number"
          ? t("explore:weather.compact", { value: Math.round(weather.temperature_c) })
          : undefined
      }
    >
      <div className={styles.body}>
        <strong>{t("explore:weather.scene")}</strong>
        <span>{weatherText(weather, weatherPending, locale)}</span>
        <div className={styles.fields}>
          <DateStepper date={date} minDate={minDate} maxDate={maxDate} onDate={onDate} />
          <HourStepper hour={hour} onHour={onHour} />
        </div>
        <SunFacts altitude={altitude} azimuth={azimuth} sunset={sunset} />
        {sunsetHour === null ? null : (
          <Button
            variant="secondary"
            icon="sunset"
            className={styles.sunset}
            disabled={sunsetHour === hour}
            onClick={() => onHour(sunsetHour)}
          >
            {t("explore:weather.atSunset")}
          </Button>
        )}
      </div>
    </Popover>
  )
}

import * as SunCalc from "suncalc"
import type { Locale } from "@/shared/i18n"
import { i18n } from "@/shared/i18n/instance"

const ZONE = "Europe/Moscow"
const HOUR_MS = 3_600_000

export const OVERVIEW_SUN = { azimuth: 335, altitude: 45 } as const

export function sceneToday(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: ZONE }).format(new Date())
}

export function forecastEnd(today: string): string {
  const end = new Date(`${today}T12:00:00Z`)
  end.setUTCDate(end.getUTCDate() + 15)
  return end.toISOString().slice(0, 10)
}

export function sunScene(date: string, hour: number, lat: number, lon: number) {
  const when = new Date(Date.parse(`${date}T00:00:00+03:00`) + hour * HOUR_MS)
  const moon = SunCalc.getMoonPosition(when, lat, lon)
  return {
    position: {
      ...SunCalc.getPosition(when, lat, lon),
      moon: {
        azimuth: moon.azimuth,
        altitude: moon.altitude,
        fraction: SunCalc.getMoonIllumination(when).fraction,
      },
    },
    times: SunCalc.getTimes(when, lat, lon),
  }
}

export function localClock(value: Date | null, locale: Locale): string | null {
  return value
    ? new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
        timeZone: ZONE,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(value)
    : null
}

export function weatherDescription(code: number, locale: Locale): string {
  if (code === 0) return i18n.t("explore:weather.clear", { lng: locale })
  if (code <= 3) return i18n.t("explore:weather.cloudy", { lng: locale })
  if (code <= 48) return i18n.t("explore:weather.fog", { lng: locale })
  if (code >= 95) return i18n.t("explore:weather.storm", { lng: locale })
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86))
    return i18n.t("explore:weather.snow", { lng: locale })
  return i18n.t("explore:weather.rain", { lng: locale })
}

export function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export function dayLabel(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T12:00:00Z`))
}

export function zoneHour(value: Date | null): number | null {
  if (!value || Number.isNaN(value.getTime())) return null
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONE,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(value)
  return Number(hour)
}

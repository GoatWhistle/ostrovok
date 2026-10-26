import type { Locale } from "@/shared/i18n"
import { i18n } from "@/shared/i18n/instance"

export function placeKind(kind: string, locale: Locale): string {
  return i18n.t(`explore:place.kinds.${kind}`, { lng: locale, defaultValue: kind })
}

export function placeName(name: string | null | undefined, kind: string, locale: Locale): string {
  return (
    name?.trim() || i18n.t("explore:place.unnamed", { kind: placeKind(kind, locale), lng: locale })
  )
}

export function walkLabel(minutes: number | null | undefined, meters: number, locale: Locale) {
  const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  return minutes == null
    ? i18n.t("explore:place.straight", { value: Math.round(meters), lng: locale })
    : i18n.t("explore:map.walkShort", { value: formatter.format(minutes), lng: locale })
}

import type { Fact } from "@/shared/api/hotel-types"
import type { Locale } from "@/shared/i18n"
import { i18n } from "@/shared/i18n/instance"

function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function season(from: number | undefined, to: number | undefined, locale: Locale) {
  if (from === undefined || to === undefined || from < 1 || to > 12 || from > to) return undefined
  const name = new Intl.DateTimeFormat(locale, { month: "long" })
  const named = (month: number) => name.format(new Date(Date.UTC(2026, month - 1, 15)))
  if (from === to) return named(from)
  return i18n.t("explore:sunsetEvidence.season", {
    lng: locale,
    from: named(from),
    to: named(to),
  })
}

export function sunsetExplanation(fact: Fact, locale: Locale): string | undefined {
  if (fact.characteristic_key !== "sunset_view") return undefined
  const marks = fact.qualifiers ?? {}
  const from = number(marks.sunset_azimuth_from_deg)
  const to = number(marks.sunset_azimuth_to_deg)
  const months = season(number(marks.season_from_month), number(marks.season_to_month), locale)
  if (from === undefined || to === undefined || !months) return undefined
  const parts = [i18n.t("explore:sunsetEvidence.arc", { lng: locale, from, to, months })]
  const facing = number(marks.facades_facing_sunset)
  if (facing === 0) {
    parts.push(i18n.t("explore:sunsetEvidence.noFacade", { lng: locale }))
    return parts.join(". ")
  }
  const floor = number(marks.from_floor)
  if (floor !== undefined)
    parts.push(i18n.t("explore:sunsetEvidence.floor", { lng: locale, floor }))
  if (marks.bookable_room_confirmed !== true)
    parts.push(i18n.t("explore:sunsetEvidence.unconfirmed", { lng: locale }))
  return parts.join(". ")
}

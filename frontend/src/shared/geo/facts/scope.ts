import type { FactBrief } from "@/shared/api/hotel-types"
import type { Locale } from "@/shared/i18n"
import { i18n } from "@/shared/i18n/instance"

export function factScope(fact: FactBrief, locale: Locale): string[] {
  const parts: string[] = []
  if (fact.subject?.startsWith("room:"))
    parts.push(i18n.t("explore:cards.roomScope", { lng: locale }))
  if (fact.subject?.startsWith("facade:"))
    parts.push(i18n.t("explore:cards.facadeScope", { lng: locale }))
  const qualifiers = fact.qualifiers ?? {}
  if (typeof qualifiers.from_floor === "number")
    parts.push(i18n.t("explore:cards.fromFloor", { lng: locale, value: qualifiers.from_floor }))
  if (typeof qualifiers.to_floor === "number")
    parts.push(i18n.t("explore:cards.toFloor", { lng: locale, value: qualifiers.to_floor }))
  if (typeof qualifiers.conditions === "string") parts.push(qualifiers.conditions)
  return parts
}

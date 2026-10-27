import type { Locale } from "@/shared/i18n"
import { i18n } from "@/shared/i18n/instance"

export function petsLabel(value: unknown, locale: Locale): string {
  const record =
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  const allowed = typeof value === "boolean" ? value : record.allowed
  const key =
    allowed === true
      ? "explore:cards.petsAllowed"
      : allowed === false
        ? "explore:cards.petsForbidden"
        : "explore:cards.petsUnknown"
  const parts = [i18n.t(key, { lng: locale })]
  if (allowed === false) return parts[0] ?? ""
  if (
    typeof record.max_weight_kg === "number" &&
    Number.isFinite(record.max_weight_kg) &&
    record.max_weight_kg >= 0
  )
    parts.push(i18n.t("explore:cards.petsWeight", { lng: locale, value: record.max_weight_kg }))
  if (typeof record.fee_rub === "number" && Number.isFinite(record.fee_rub) && record.fee_rub >= 0)
    parts.push(
      i18n.t(record.fee_rub === 0 ? "explore:cards.petsFree" : "explore:cards.petsFee", {
        lng: locale,
        value: record.fee_rub,
      }),
    )
  return parts.join(". ")
}

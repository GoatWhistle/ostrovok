import type { Fact } from "@/shared/api/hotel-types"
import type { Locale } from "@/shared/i18n"
import { i18n } from "@/shared/i18n/instance"

export function viewExplanation(fact: Fact, locale: Locale): string | undefined {
  const raw = fact.qualifiers?.visibility
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined
  const view = raw as Record<string, unknown>
  const status = view.status
  if (status !== "visible" && status !== "blocked" && status !== "unknown") return undefined
  const parts = [i18n.t(`explore:viewEvidence.${status}`, { lng: locale })]
  if (typeof view.target_name === "string" && view.target_name.trim())
    parts.push(view.target_name.trim())
  if (typeof view.floor === "number" && Number.isInteger(view.floor) && view.floor > 0)
    parts.push(i18n.t("explore:viewEvidence.floor", { lng: locale, floor: view.floor }))
  if (
    typeof view.distance_m === "number" &&
    Number.isFinite(view.distance_m) &&
    view.distance_m > 0
  )
    parts.push(
      i18n.t("explore:viewEvidence.distance", {
        lng: locale,
        distance: new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
          view.distance_m,
        ),
      }),
    )
  if (view.requested_target_scope === "whole" && view.entire_target_verified !== true)
    parts.push(i18n.t("explore:viewEvidence.wholeUnknown", { lng: locale }))
  if (Array.isArray(view.missing) && view.missing.length)
    parts.push(i18n.t("explore:viewEvidence.missing", { lng: locale }))
  parts.push(i18n.t("explore:viewEvidence.facade", { lng: locale }))
  return parts.join(". ")
}

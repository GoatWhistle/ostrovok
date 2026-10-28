import { useFormatters, useTranslation } from "@/shared/i18n"
import { characteristicHue, characteristicIcon, type IconName } from "@/shared/ui"
import type { ChatFilter } from "../filter-set"

const STAY_ICON: Readonly<Record<string, IconName>> = {
  location: "pin",
  dates: "calendar",
  guests: "guests",
}

const STAY_HUE: Readonly<Record<string, string>> = {
  location: "var(--hue-walk)",
  dates: "var(--hue-sea)",
  guests: "var(--hue-room)",
}

export function filterIcon(filter: ChatFilter): IconName {
  return STAY_ICON[filter.kind] ?? characteristicIcon(filter.key ?? "")
}

export function filterHue(filter: ChatFilter): string {
  return STAY_HUE[filter.kind] ?? characteristicHue(filter.key ?? "")
}

export function useFilterText(): (filter: ChatFilter) => string {
  const { t } = useTranslation()
  const format = useFormatters()
  return (filter: ChatFilter) => {
    if (filter.kind === "guests") return t("explore:offers.adults", { count: filter.adults ?? 0 })
    if (filter.kind !== "dates") return (filter.label ?? "").trim()
    if (!filter.check_in) return ""
    const from = format.shortDate(filter.check_in)
    if (!filter.check_out) return from
    return t("explore:chat.progress.dates", { from, to: format.shortDate(filter.check_out) })
  }
}

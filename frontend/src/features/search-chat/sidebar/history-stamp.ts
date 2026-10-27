import type { Formatters } from "@/shared/i18n"
import { daysAgo } from "./history-groups"

export function historyStamp(format: Formatters, value: string | undefined): string | undefined {
  if (!value) return undefined
  const days = daysAgo(value)
  if (days <= 0) return format.time(value)
  if (days === 1) return format.relative(-1, "day")
  return format.shortDate(value)
}

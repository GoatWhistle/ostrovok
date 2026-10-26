import type { Formatters } from "@/shared/i18n"

const DAY_MS = 86_400_000

function daysAgo(value: string) {
  const start = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  return Math.round((start(new Date()) - start(new Date(value))) / DAY_MS)
}

export function historyStamp(format: Formatters, value: string | undefined): string | undefined {
  if (!value) return undefined
  const days = daysAgo(value)
  if (days <= 0) return format.time(value)
  if (days === 1) return format.relative(-1, "day")
  return format.shortDate(value)
}

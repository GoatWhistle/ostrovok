export type HistoryGroup = "today" | "yesterday" | "earlier"

export interface HistoryEntry {
  readonly id: string
  readonly title: string
  readonly updatedAt?: string
}

export interface HistorySection {
  readonly group: HistoryGroup
  readonly entries: readonly HistoryEntry[]
}

const DAY_MS = 86_400_000
const ORDER: readonly HistoryGroup[] = ["today", "yesterday", "earlier"]

function dayStart(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

export function daysAgo(value: string, now: Date = new Date()): number {
  return Math.round((dayStart(now) - dayStart(new Date(value))) / DAY_MS)
}

function groupOf(entry: HistoryEntry, now: Date): HistoryGroup {
  if (!entry.updatedAt || Number.isNaN(Date.parse(entry.updatedAt))) return "today"
  const days = daysAgo(entry.updatedAt, now)
  if (days <= 0) return "today"
  return days === 1 ? "yesterday" : "earlier"
}

function stamp(entry: HistoryEntry): number {
  const time = entry.updatedAt ? Date.parse(entry.updatedAt) : Number.NaN
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time
}

export function groupHistory(
  entries: readonly HistoryEntry[],
  now: Date = new Date(),
): readonly HistorySection[] {
  const sorted = entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => stamp(b.entry) - stamp(a.entry) || a.index - b.index)
    .map(({ entry }) => entry)
  return ORDER.map((group) => ({
    group,
    entries: sorted.filter((entry) => groupOf(entry, now) === group),
  })).filter((section) => section.entries.length > 0)
}

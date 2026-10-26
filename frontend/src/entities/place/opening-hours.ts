export interface HoursRule {
  readonly days: readonly number[]
  readonly intervals: readonly (readonly [number, number])[]
}

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
const DAY = "(?:Mo|Tu|We|Th|Fr|Sa|Su)"
const RULE = new RegExp(`^(?:(${DAY}(?:-${DAY})?(?:,\\s*${DAY}(?:-${DAY})?)*)\\s+)?(.+)$`)

function dayList(value: string | undefined): number[] | undefined {
  if (!value) return DAYS.map((_, index) => index)
  const result: number[] = []
  for (const part of value.split(/,\s*/)) {
    const [first = "", last = first] = part.split("-")
    const start = DAYS.indexOf(first)
    const end = DAYS.indexOf(last)
    if (start < 0 || end < 0) return undefined
    for (let offset = 0; offset <= (end - start + 7) % 7; offset++)
      result.push((start + offset) % 7)
  }
  return result
}

function minute(value: string): number | undefined {
  if (!/^\d{2}:\d{2}$/.test(value)) return undefined
  const [hour = -1, minutes = -1] = value.split(":").map(Number)
  if (hour > 24 || minutes > 59 || (hour === 24 && minutes !== 0)) return undefined
  return hour * 60 + minutes
}

function intervals(value: string): HoursRule["intervals"] | undefined {
  if (value === "off" || value === "closed") return []
  const result: [number, number][] = []
  for (const part of value.split(/,\s*/)) {
    const pair = part.trim().split("-")
    if (pair.length !== 2) return undefined
    const start = minute(pair[0] ?? "")
    const end = minute(pair[1] ?? "")
    if (start === undefined || end === undefined || start === 1440 || start === end)
      return undefined
    result.push([start, end < start ? end + 1440 : end])
  }
  return result
}

export function parseOpeningHours(value: string): readonly HoursRule[] | undefined {
  if (value.trim() === "24/7") return [{ days: [0, 1, 2, 3, 4, 5, 6], intervals: [[0, 1440]] }]
  const result: HoursRule[] = []
  for (const part of value.split(";")) {
    const match = RULE.exec(part.trim())
    if (!match) return undefined
    const days = dayList(match[1])
    const times = intervals(match[2] ?? "")
    if (!days || !times) return undefined
    result.push({ days, intervals: times })
  }
  return result.length ? result : undefined
}

export function isOpen(rules: readonly HoursRule[], date: string, hour: number): boolean {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay()
  const today = rules.findLast((rule) => rule.days.includes(day))
  const yesterday = rules.findLast((rule) => rule.days.includes((day + 6) % 7))
  const now = hour * 60
  const current = today?.intervals.some(([start, end]) => now >= start && now < end) ?? false
  const overnight =
    yesterday?.intervals.some(([start, end]) => now + 1440 >= start && now + 1440 < end) ?? false
  return current || overnight
}

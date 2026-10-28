import { i18n } from "@/shared/i18n/instance"
import ru from "@/shared/i18n/locales/ru/explore.json"

type Topic = keyof typeof ru.supplier.wishTopics

function topicStems(): string[][] {
  return (Object.keys(ru.supplier.wishTopics) as Topic[]).map((topic) =>
    (["ru", "en"] as const).flatMap((lng) =>
      i18n.t(`explore:supplier.wishTopics.${topic}`, { lng }).split(" "),
    ),
  )
}

function words(text: string): string[] {
  return text
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 3)
}

export function wishTerms(labels: readonly string[]): string[] {
  const found = new Set<string>()
  const topics = topicStems()
  for (const label of labels) {
    const tokens = words(label)
    for (const stems of topics)
      if (tokens.some((token) => stems.some((stem) => token.startsWith(stem))))
        for (const stem of stems) found.add(stem)
  }
  return [...found]
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function termPattern(terms: readonly string[]): RegExp | undefined {
  if (!terms.length) return undefined
  return new RegExp(`(?<!\\p{L})((?:${terms.map(escapeRegExp).join("|")})\\p{L}*)`, "iu")
}

export function mentions(text: string, pattern: RegExp | undefined): boolean {
  return pattern ? pattern.test(text) : false
}

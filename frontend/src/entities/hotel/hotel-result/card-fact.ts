import type { MatchedProperty } from "@/shared/api/hotel-types"
import { isUsableMatch } from "@/shared/geo/facts/matching"
import { wishVerdict } from "@/shared/geo/facts/wish-verdict"
import type { Locale } from "@/shared/i18n"

const MEASURED = /\d/

export function cardFact(matched: readonly MatchedProperty[], locale: Locale): string | undefined {
  const verdicts = matched
    .filter(isUsableMatch)
    .sort((a, b) => Number(b.match === "full") - Number(a.match === "full"))
    .flatMap((item) => {
      const verdict = wishVerdict(item, locale)
      return verdict ? [verdict] : []
    })
  return verdicts.find((text) => MEASURED.test(text)) ?? verdicts[0]
}

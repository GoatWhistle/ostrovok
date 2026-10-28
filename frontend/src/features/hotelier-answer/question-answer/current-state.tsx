import { useHotel } from "@/entities/hotel"
import { factLabel } from "@/shared/geo/facts/fact-label"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Banner } from "@/shared/ui"

const RANK: Readonly<Record<string, number>> = {
  confirmed_by_hotelier: 0,
  active: 1,
  conflicted: 2,
  stale: 3,
}

export interface CurrentStateProps {
  readonly hotelId: string
  readonly characteristicKey: string | undefined
}

export function CurrentState({ hotelId, characteristicKey }: CurrentStateProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const hotel = useHotel(hotelId)
  if (!hotel.isSuccess || !characteristicKey) return null
  const current = hotel.data.facts
    .filter((fact) => fact.characteristic_key === characteristicKey && fact.status in RANK)
    .sort(
      (a, b) =>
        (RANK[a.status] ?? 0) - (RANK[b.status] ?? 0) ||
        (b.provenance?.computed_at ?? "").localeCompare(a.provenance?.computed_at ?? "") ||
        b.confidence - a.confidence,
    )[0]
  if (!current)
    return (
      <Banner tone="info" title={t("explore:hotelier.currentNone")}>
        {t("explore:hotelier.currentNoneText")}
      </Banner>
    )
  return (
    <Banner
      tone="info"
      title={t("explore:hotelier.current", { value: factLabel(current, locale) })}
    >
      {t("explore:hotelier.currentText", { source: t(`explore:source.${current.source_type}`) })}
    </Banner>
  )
}

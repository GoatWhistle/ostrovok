import { useHotel } from "@/entities/hotel"
import { factLabel } from "@/shared/geo/fact-label"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Banner } from "@/shared/ui"

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
    .filter((fact) => fact.characteristic_key === characteristicKey)
    .reduce<(typeof hotel.data.facts)[number] | undefined>(
      (best, fact) => (best && best.confidence >= fact.confidence ? best : fact),
      undefined,
    )
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

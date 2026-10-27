import { useHotel } from "@/entities/hotel"
import type { FactBrief } from "@/shared/api/hotel-types"
import { useTranslation } from "@/shared/i18n"
import { EmptyState, ErrorState, Skeleton } from "@/shared/ui"
import { FactList } from "./fact-list"

export interface HotelFactsProps {
  readonly hotelId: string
  readonly title: string
  readonly onFact: (fact: FactBrief) => void
}

export function HotelFacts({ hotelId, title, onFact }: HotelFactsProps) {
  const { t } = useTranslation()
  const hotel = useHotel(hotelId)
  if (hotel.isPending) return <Skeleton lines={4} />
  if (hotel.isError)
    return (
      <ErrorState
        title={t("explore:details.error")}
        onRetry={() => void hotel.refetch()}
        retryPending={hotel.isFetching}
      />
    )
  if (!hotel.data.facts.length)
    return <EmptyState icon="empty" title={t("explore:details.factsEmpty")} />
  return <FactList title={title} facts={hotel.data.facts} onFact={onFact} />
}

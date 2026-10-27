import { FactDetails } from "@/features/fact-details"
import { HotelDetails } from "@/features/hotel-details"
import type { useHotelWorkspace } from "@/features/hotel-search"
import { PlaceDetails } from "@/features/place-details"
import { Swap } from "@/shared/motion"

type Workspace = ReturnType<typeof useHotelWorkspace>
export function HotelContent({
  state,
  time,
  onOpenPage,
}: {
  readonly state: Workspace
  readonly time: { date: string; hour: number }
  readonly onOpenPage?: (() => void) | undefined
}) {
  const hotelId = state.hotelId
  if (!hotelId) return null
  const selected = state.results.find((item) => item.hotel.id === hotelId)
  return (
    <Swap swapKey={state.placeId ?? state.factId ?? hotelId} as="div">
      {state.placeId ? (
        <PlaceDetails
          id={state.placeId}
          hotelId={hotelId}
          date={time.date}
          hour={time.hour}
          onBack={state.closePlace}
          onRoute={state.placeRoute}
        />
      ) : state.factId ? (
        <FactDetails hotelId={hotelId} factId={state.factId} onBack={state.closeFact} />
      ) : (
        <HotelDetails
          hotelId={hotelId}
          matched={selected?.matched ?? []}
          stay={state.search?.parsed}
          onProperty={selected ? (item) => state.property(selected, item) : undefined}
          onFact={state.fact}
          onPreview={(item) => selected && state.preview(selected, item)}
          onOpenPage={onOpenPage}
        />
      )}
    </Swap>
  )
}

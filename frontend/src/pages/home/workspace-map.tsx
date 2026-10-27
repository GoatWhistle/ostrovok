import { lazy, Suspense } from "react"
import type { useHotelWorkspace } from "@/features/hotel-search"
import { useMediaQuery } from "@/shared/hooks"
import { CompareDock } from "./compare-dock"
import { MapHotel } from "./map-hotel/map-hotel"

const HotelMap = lazy(() =>
  import("@/features/hotel-map").then((module) => ({ default: module.HotelMap })),
)
type Workspace = ReturnType<typeof useHotelWorkspace>
export function WorkspaceMap({
  state,
  visible,
  onSelect,
  onTimeChange,
  time,
  onMove,
}: {
  readonly state: Workspace
  readonly visible: boolean
  readonly onSelect: Workspace["select"]
  readonly onMove: (action: () => void) => void
  readonly time: { readonly date: string; readonly hour: number }
  readonly onTimeChange: (date: string, hour: number) => void
}) {
  const narrow = useMediaQuery("(max-width: 63.99rem)")
  const sheet = state.surface === "map" || (narrow && state.view === "map")
  return (
    <Suspense fallback={null}>
      <HotelMap
        visible={visible}
        fullMap={state.surface === "map"}
        returnToHotel={state.navigation.returnToHotel}
        onExpand={() => onMove(state.navigation.expandMap)}
        onExit={() => onMove(state.navigation.returnFromSurface)}
        hotelCard={
          sheet && state.hotelId ? (
            <MapHotel
              key={state.hotelId}
              onClose={() => onMove(state.closeHotel)}
              state={state}
              time={time}
              onOpen={(section) => {
                const id = state.hotelId
                if (id) onMove(() => state.navigation.openHotelPage(id, section))
              }}
            />
          ) : null
        }
        onAppearance={state.navigation.setAppearance}
        hotelId={state.hotelId}
        camera={state.camera}
        geoRefs={state.geoRefs}
        focusedFact={state.focusedFact}
        previewing={state.previewing}
        focusProperty={state.focusProperty}
        regionId={state.search ? "russia" : "sochi"}
        results={state.results}
        bounds={state.bounds}
        onSelect={onSelect}
        onPlace={state.openPlace}
        onTimeChange={onTimeChange}
        bottomCenter={<CompareDock ids={state.compared} limit={state.limitReached} />}
      />
    </Suspense>
  )
}

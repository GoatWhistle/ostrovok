import { lazy, Suspense } from "react"
import type { useHotelWorkspace } from "@/features/hotel-search"
import { CompareDock } from "./compare-dock"

const HotelMap = lazy(() =>
  import("@/features/hotel-map").then((module) => ({ default: module.HotelMap })),
)
type Workspace = ReturnType<typeof useHotelWorkspace>
export function WorkspaceMap({
  state,
  visible,
  onSelect,
  onTimeChange,
}: {
  readonly state: Workspace
  readonly visible: boolean
  readonly onSelect: Workspace["select"]
  readonly onTimeChange: (date: string, hour: number) => void
}) {
  return (
    <Suspense fallback={null}>
      <HotelMap
        visible={visible}
        onAppearance={state.navigation.setAppearance}
        hotelId={state.hotelId}
        camera={state.camera}
        geoRefs={state.geoRefs}
        focusedFact={state.focusedFact}
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

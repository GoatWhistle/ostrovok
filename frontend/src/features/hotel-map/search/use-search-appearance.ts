import { useRef } from "react"
import type { SearchJourney } from "@/shared/api/search-journey"
import type { MapAppearance } from "@/shared/geo/appearance/types"

export function useSearchAppearance(journey: SearchJourney | undefined, chosen: MapAppearance) {
  const initial = useRef({ request: journey?.request, chosen })
  if (initial.current.request !== journey?.request)
    initial.current = { request: journey?.request, chosen }
  return journey && initial.current.chosen === chosen ? "toy-town" : undefined
}

import { useEffect, useRef } from "react"
import type { searchJourney } from "./search-journey"
import type { WorkspaceTab } from "./workspace-location"

export function useSearchPresentation(
  journey: ReturnType<typeof searchJourney>,
  active: boolean,
  request: number,
  setView: (tab: WorkspaceTab) => void,
) {
  const routeAnimation = active && journey.routeSearch
  const animatedRequest = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (routeAnimation && animatedRequest.current !== request) {
      animatedRequest.current = request
      setView("map")
    }
  }, [routeAnimation, request, setView])
  return {
    routeAnimation,
    waiting: journey.sending && !routeAnimation,
    compact: routeAnimation && (journey.sending || ["city", "unresolved"].includes(journey.status)),
  }
}

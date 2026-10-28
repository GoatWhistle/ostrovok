import { useEffect, useMemo, useState } from "react"
import type { SearchJourney } from "@/shared/api/search-journey"
import type { SearchPreview } from "@/shared/api/search-preview"
import { motionMs } from "@/shared/motion"
import { useSearchRating } from "./use-search-rating"

export function useSearchTour(journey: SearchJourney | undefined, reduced: boolean) {
  const rated = useSearchRating(journey)
  const [visit, setVisit] = useState({ request: journey?.request, index: 0 })
  const index = visit.request === journey?.request ? visit.index : 0
  const scenes = useMemo<readonly SearchPreview[]>(() => {
    const routes = journey?.previews ?? []
    const walks = routes.filter((scene) => scene.mode === "graph" && scene.route)
    return walks.length ? walks : routes.slice(0, 1)
  }, [journey?.previews])
  useEffect(() => {
    if (!journey?.sending || journey.winner || reduced || scenes.length < 2) return
    const timer = window.setTimeout(
      () => setVisit({ request: journey.request, index: (index + 1) % scenes.length }),
      motionMs("--story-search-visit"),
    )
    return () => window.clearTimeout(timer)
  }, [journey?.sending, journey?.winner, journey?.request, scenes.length, index, reduced])
  if (journey?.status === "error" || journey?.status === "empty") return undefined
  return rated ?? journey?.winner ?? (journey?.sending ? scenes[index % scenes.length] : undefined)
}

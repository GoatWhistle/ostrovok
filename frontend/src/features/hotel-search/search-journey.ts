import type { ChatProgress } from "@/shared/api"
import type { components } from "@/shared/api/schema.gen"

type SearchResponse = components["schemas"]["SearchResponse"]

function waitingStatus(stage: string | undefined, location: string | null | undefined) {
  if (["research", "wish", "review", "preview", "winner"].includes(stage ?? "")) return "checking"
  return location ? "searching" : "locating"
}

function statusOf(
  events: readonly ChatProgress[],
  sending: boolean,
  failed: boolean,
  search: SearchResponse | undefined,
  location: string | null | undefined,
) {
  if (failed) return "error"
  if (events.some((event) => event.unsupported) || search?.parsed.unsupported_region)
    return "unresolved"
  if (events.some((event) => event.stage === "parsed") && !location) return "city"
  if (search?.parsed.needs_clarification && !location) return "city"
  if (sending) return waitingStatus(events.at(-1)?.stage, location)
  return search?.results.length === 0 ? "empty" : "done"
}

export function searchJourney(
  events: readonly ChatProgress[],
  sending: boolean,
  failed: boolean,
  search: SearchResponse | undefined,
) {
  const current = sending ? undefined : search
  const parsed = events.findLast((event) => event.stage === "parsed")
  const candidates = events.findLast((event) => event.stage === "candidates")
  const location = candidates?.location ?? parsed?.location ?? current?.parsed.location_hint
  const bestScore = Math.max(...(current?.results.map((item) => item.score) ?? []))
  return {
    routeSearch: parsed?.route_search ?? events.some((event) => Boolean(event.preview?.mode)),
    finalists:
      current?.results.filter((item) => item.score === bestScore).map((item) => item.hotel) ?? [],
    previews: events.flatMap((event) =>
      event.stage === "preview" && event.preview ? [event.preview] : [],
    ),
    winner: events.findLast((event) => event.stage === "winner")?.preview,
    status: statusOf(events, sending, failed, current, location),
    location,
    bounds: candidates?.bbox ?? current?.viewport?.bbox ?? undefined,
    candidates: sending ? (candidates?.hotels ?? []) : [],
    sending,
  }
}

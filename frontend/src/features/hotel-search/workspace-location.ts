import type { MapAppearance } from "@/shared/geo/appearance/types"

export type WorkspaceSurface =
  | "landing"
  | "conversation"
  | "workspace"
  | "hotel-panel"
  | "map"
  | "hotel-page"
export type WorkspaceTab = "chat" | "hotels" | "map"
export type { MapAppearance } from "@/shared/geo/appearance/types"
export type HotelOrigin = "panel" | "map"
export type HotelSection = "offers" | "rooms" | "views" | "photos" | "facts" | "services"

export interface WorkspaceLocation {
  readonly chat: string | null
  readonly hotel: string | undefined
  readonly fullMap: boolean
  readonly hotelPage: boolean
  readonly from: HotelOrigin | undefined
  readonly section: HotelSection | undefined
  readonly appearance: MapAppearance | undefined
  readonly tab: WorkspaceTab
}

const identifier = (value: string | null | undefined) =>
  value && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/.test(value) ? value : undefined

function pick<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return allowed.find((item) => item === value)
}

export function readWorkspaceLocation(pathname: string, search: string): WorkspaceLocation {
  const params = new URLSearchParams(search)
  let hotelPath: string | undefined
  try {
    hotelPath = identifier(decodeURIComponent(/^\/hotels\/([^/]+)\/?$/.exec(pathname)?.[1] ?? ""))
  } catch {
    hotelPath = undefined
  }
  return {
    chat: identifier(params.get("chat")) ?? null,
    hotel: hotelPath ?? identifier(params.get("hotel")),
    fullMap: !hotelPath && params.get("map") === "full",
    hotelPage: hotelPath !== undefined,
    from: hotelPath ? pick(params.get("from"), ["panel", "map"]) : undefined,
    section: hotelPath
      ? pick(params.get("section"), ["offers", "rooms", "views", "photos", "facts", "services"])
      : undefined,
    appearance: pick(params.get("style"), ["neon", "toy-town"]),
    tab: pick(params.get("tab"), ["chat", "hotels", "map"]) ?? "chat",
  }
}

export function workspaceHref(route: WorkspaceLocation): string {
  const params = new URLSearchParams()
  if (route.chat) params.set("chat", route.chat)
  if (route.hotel && !route.hotelPage) params.set("hotel", route.hotel)
  if (route.fullMap && !route.hotelPage) params.set("map", "full")
  if (route.hotelPage && route.from) params.set("from", route.from)
  if (route.hotelPage && route.section) params.set("section", route.section)
  if (route.appearance) params.set("style", route.appearance)
  if (route.tab !== "chat") params.set("tab", route.tab)
  const path = route.hotelPage && route.hotel ? `/hotels/${encodeURIComponent(route.hotel)}` : "/"
  const query = params.toString()
  return path + (query ? `?${query}` : "")
}

export function workspaceSurface(
  route: WorkspaceLocation,
  started: boolean,
  hasHotels: boolean,
): WorkspaceSurface {
  if (route.hotelPage) return "hotel-page"
  if (route.fullMap) return "map"
  if (route.hotel) return "hotel-panel"
  if (hasHotels) return "workspace"
  return started ? "conversation" : "landing"
}

export function safeWorkspaceReturn(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^\/(?:\?|hotels\/|$)/.test(value)) return undefined
  const index = value.indexOf("?")
  const path = index < 0 ? value : value.slice(0, index)
  return workspaceHref(readWorkspaceLocation(path, index < 0 ? "" : value.slice(index)))
}

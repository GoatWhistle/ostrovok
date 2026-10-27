import { useEffect, useRef } from "react"
import { useLocation, useNavigate } from "react-router"
import {
  type HotelSection,
  type MapAppearance,
  readWorkspaceLocation,
  safeWorkspaceReturn,
  type WorkspaceLocation,
  type WorkspaceTab,
  workspaceHref,
} from "./workspace-location"

type NavigationState = {
  started?: boolean
  draftId?: string
  returnTo?: string
  returnTrail?: readonly string[]
}

function navigationState(value: unknown): NavigationState {
  if (!value || typeof value !== "object") return {}
  const candidate = value as NavigationState
  return {
    ...(Array.isArray(candidate.returnTrail)
      ? {
          returnTrail: candidate.returnTrail
            .flatMap((value: unknown) => {
              const href = safeWorkspaceReturn(value)
              return href ? [href] : []
            })
            .slice(-8),
        }
      : {}),
    ...(candidate.started === true ? { started: true } : {}),
    ...(typeof candidate.draftId === "string" ? { draftId: candidate.draftId } : {}),
    ...(safeWorkspaceReturn(candidate.returnTo)
      ? { returnTo: safeWorkspaceReturn(candidate.returnTo) as string }
      : {}),
  }
}

export function useWorkspaceNavigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const route = readWorkspaceLocation(location.pathname, location.search)
  const current = useRef(route)
  current.current = route
  const state = navigationState(location.state)
  const currentState = useRef(state)
  currentState.current = state
  const href = workspaceHref(route)
  const scopeKey = route.chat ?? state.draftId ?? location.key
  const trail =
    route.fullMap || route.hotelPage
      ? [...(state.returnTrail ?? []), ...(state.returnTo ? [state.returnTo] : [])]
      : []
  useEffect(() => {
    if (location.pathname + location.search !== href) {
      void navigate(href, { replace: true, state: location.state })
    }
  }, [href, location.pathname, location.search, location.state, navigate])
  function change(next: Partial<WorkspaceLocation>, replace = false, nextState?: NavigationState) {
    current.current = { ...current.current, ...next }
    currentState.current = {
      ...(nextState ?? currentState.current),
      draftId: nextState?.draftId ?? currentState.current.draftId ?? scopeKey,
    }
    void navigate(workspaceHref(current.current), { replace, state: currentState.current })
  }
  function openConversation(id: string | null) {
    change(
      {
        chat: id,
        hotel: undefined,
        hotelPage: false,
        fullMap: false,
        from: undefined,
        section: undefined,
        tab: "chat",
      },
      false,
      { started: true, draftId: crypto.randomUUID() },
    )
  }
  return {
    route,
    scopeKey,
    started: Boolean(state.started || route.chat || route.hotel || route.fullMap),
    begin: () => change({}, true, { ...state, started: true }),
    receiveConversation: (id: string) => change({ chat: id }, true, { ...state, started: true }),
    openConversation,
    reset: () => openConversation(null),
    landing: () => {
      void navigate(
        workspaceHref({
          ...route,
          chat: null,
          hotel: undefined,
          hotelPage: false,
          fullMap: false,
          from: undefined,
          section: undefined,
          tab: "chat",
        }),
        { state: { draftId: crypto.randomUUID() } },
      )
    },
    selectHotel: (hotel: string | undefined) =>
      change({ hotel, hotelPage: false, tab: route.tab === "map" ? "map" : "hotels" }),
    setTab: (tab: WorkspaceTab) => change({ tab }, true),
    setAppearance: (appearance: MapAppearance) => change({ appearance }, true),
    openHotelPage: (hotel: string, section?: HotelSection) =>
      change(
        { hotel, hotelPage: true, fullMap: false, from: route.fullMap ? "map" : "panel", section },
        false,
        {
          ...state,
          returnTo: href,
          returnTrail: trail,
        },
      ),
    expandMap: () =>
      change(
        { hotelPage: false, fullMap: true, from: undefined, section: undefined, tab: "map" },
        false,
        {
          ...state,
          returnTo: href,
          returnTrail: trail,
        },
      ),
    returnFromSurface: () => {
      if (!state.returnTo && route.hotelPage && !route.from) {
        change(
          {
            chat: null,
            hotel: undefined,
            hotelPage: false,
            fullMap: false,
            from: undefined,
            section: undefined,
            tab: "chat",
          },
          false,
          { draftId: crypto.randomUUID() },
        )
        return
      }
      const fallback = workspaceHref({
        ...route,
        hotelPage: false,
        fullMap: route.hotelPage && route.from === "map",
        from: undefined,
        section: undefined,
      })
      const target = state.returnTo ?? fallback
      const url = new URL(target, window.location.origin)
      const restored = readWorkspaceLocation(url.pathname, url.search)
      const trail = [...(state.returnTrail ?? [])]
      const parent = trail.pop()
      void navigate(
        workspaceHref({
          ...restored,
          appearance: route.appearance ?? restored.appearance,
          ...(route.fullMap ? { hotel: route.hotel } : {}),
        }),
        {
          state: { ...state, returnTo: parent, returnTrail: trail },
        },
      )
    },
  }
}

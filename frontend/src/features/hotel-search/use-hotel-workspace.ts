import { useEffect, useRef, useState } from "react"
import type { FactBrief, MatchedProperty, SearchResult } from "@/shared/api/hotel-types"
import { type Conversation, useConversation } from "./use-conversation"
import { useHotelSelection } from "./use-hotel-selection"
import { useListReturn } from "./use-list-return"
import { useWorkspaceExpansion } from "./use-workspace-expansion"
import { useWorkspaceNavigation } from "./use-workspace-navigation"
import { workspaceSurface } from "./workspace-location"

export type WorkspaceView = "chat" | "hotels" | "map"

const NARROW = "(max-width: 63.99rem)"

type Message = NonNullable<Conversation["messages"]>[number]

function ordered(messages: readonly Message[]): readonly Message[] {
  return [...messages].sort(
    (a, b) =>
      a.created_at.localeCompare(b.created_at) ||
      Number(a.role === "assistant") - Number(b.role === "assistant"),
  )
}

export function useHotelWorkspace() {
  const navigation = useWorkspaceNavigation()
  const hotelId = navigation.route.hotel
  const setHotelId = navigation.selectHotel
  const selection = useHotelSelection(navigation.scopeKey, hotelId)
  const { placeId, factId, camera, previewRefs, previewMatch, geoRefs, focusedFact, focusedMatch } =
    selection.state
  const setPlaceId = (placeId: string | undefined) => selection.update({ placeId })
  const setFactId = (factId: string | undefined) => selection.update({ factId })
  const setCamera = (camera: typeof selection.state.camera) => selection.update({ camera })
  const setGeoRefs = (geoRefs: readonly string[]) => selection.update({ geoRefs })
  const setFocusedFact = (focusedFact: FactBrief | undefined) => selection.update({ focusedFact })
  const setFocusedMatch = (focusedMatch: MatchedProperty | undefined) =>
    selection.update({ focusedMatch })
  const setPreviewRefs = (previewRefs: readonly string[] | undefined) =>
    selection.update({ previewRefs })
  const setPreviewMatch = (previewMatch: MatchedProperty | undefined) =>
    selection.update({ previewMatch })
  const [compared, setCompared] = useState<readonly string[]>([])
  const [limitReached, setLimitReached] = useState(false)
  const view = navigation.route.tab
  const setView = navigation.setTab
  const detailRef = useRef<HTMLDivElement>(null)
  const clearEvidence = selection.clear
  function clearSelection() {
    clearEvidence()
    setHotelId(undefined)
  }
  const chat = useConversation(
    hotelId,
    (data: Conversation) => {
      const answer = data.messages.findLast((item) => item.role === "assistant")
      if (data.search_message_id !== undefined && data.search_message_id !== answer?.id) return
      setPlaceId(undefined)
      setFactId(undefined)
      setPreviewRefs(undefined)
      setPreviewMatch(undefined)
      setFocusedMatch(undefined)
      if (hotelId && !data.search?.results.some((item) => item.hotel.id === hotelId))
        clearSelection()
    },
    {
      id: navigation.route.chat,
      scopeKey: navigation.scopeKey,
      begin: navigation.begin,
      receive: navigation.receiveConversation,
      open: (id) => navigation.openConversation(id),
      reset: navigation.reset,
    },
  )
  const search = chat.data?.search ?? undefined
  const results = [
    ...new Map((search?.results ?? []).map((result) => [result.hotel.id, result])).values(),
  ]
  const expanded = useWorkspaceExpansion(navigation.scopeKey, results.length > 0)
  const list = useListReturn(navigation.scopeKey, hotelId, results.length)
  const activeSubject = placeId ?? factId ?? hotelId
  useEffect(() => {
    if (activeSubject && view === "hotels" && (placeId || window.matchMedia(NARROW).matches))
      detailRef.current?.focus()
  }, [activeSubject, view, placeId])
  function select(result: SearchResult) {
    list.capture(result.hotel.id)
    selection.select(result.hotel.id, result.camera)
    setHotelId(result.hotel.id)
    setView(view === "map" ? "map" : "hotels")
  }
  function property(result: SearchResult, item: MatchedProperty) {
    list.capture(result.hotel.id)
    selection.update(
      {
        camera: item.camera ?? result.camera,
        placeId: undefined,
        factId: undefined,
        geoRefs: item.geo_refs ?? item.fact?.geo_refs ?? [],
        focusedFact: item.fact ?? undefined,
        focusedMatch: item,
        previewMatch: undefined,
        previewRefs: undefined,
      },
      result.hotel.id,
    )
    setHotelId(result.hotel.id)
    setView("map")
  }
  function fact(item: FactBrief) {
    setPlaceId(undefined)
    setFactId(item.fact_id)
    setGeoRefs(item.geo_refs ?? [])
    setFocusedFact(item)
    setFocusedMatch(undefined)
    setCamera(undefined)
  }
  function compare(id: string) {
    if (compared.includes(id)) {
      setCompared(compared.filter((item) => item !== id))
      setLimitReached(false)
    } else if (compared.length < 5) {
      setCompared([...compared, id])
      setLimitReached(false)
    } else setLimitReached(true)
  }
  return {
    navigation,
    surface: workspaceSurface(navigation.route, navigation.started, expanded),
    messages: ordered(chat.data?.messages ?? []),
    conversationId: chat.conversationId,
    searchMessageId: chat.data?.search_message_id,
    history: chat.history,
    search,
    outgoing: chat.outgoing,
    send: chat.send,
    retry: chat.retry,
    clearTransient: () => {
      clearEvidence()
      setCompared([])
      setLimitReached(false)
    },
    reset: () => {
      clearEvidence()
      setCompared([])
      chat.reset()
      setView("chat")
    },
    renameConversation: chat.rename,
    deleteConversation: (id: string) => {
      if (id === chat.conversationId) {
        clearEvidence()
        setCompared([])
      }
      return chat.remove(id)
    },
    openConversation: (id: string) => {
      clearEvidence()
      setCompared([])
      chat.open(id)
      setView("chat")
    },
    chatLoading: chat.loading,
    sending: chat.sending,
    chatFailed: chat.failed,
    showOnMap: (result: SearchResult | undefined) => {
      if (result) select(result)
      setView("map")
    },
    results,
    bounds: hotelId ? undefined : search?.viewport?.bbox,
    detailRef,
    listRef: list.listRef,
    hotelId,
    placeId,
    openPlace: (id: string) => {
      setPlaceId(id)
      setView("hotels")
    },
    closePlace: () => setPlaceId(undefined),
    placeRoute: (ref: string) => {
      setGeoRefs(placeId ? [ref, `g_poi_${placeId}`] : [ref])
      setPreviewRefs(undefined)
      setPreviewMatch(undefined)
      setView("map")
    },
    factId,
    camera,
    geoRefs: previewRefs ?? geoRefs,
    focusedFact,
    focusProperty: previewMatch ?? focusedMatch,
    preview: (result: SearchResult, item: MatchedProperty | undefined) => {
      const active = result.hotel.id === hotelId ? item : undefined
      setPreviewRefs(active?.geo_refs ?? active?.fact?.geo_refs)
      setPreviewMatch(active)
    },
    compared,
    compare,
    limitReached,
    view,
    setView,
    select,
    property,
    fact,
    closeHotel: clearSelection,
    closeFact: () => setFactId(undefined),
  }
}

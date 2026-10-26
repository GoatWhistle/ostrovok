import { useEffect, useRef, useState } from "react"
import type { Camera, FactBrief, MatchedProperty, SearchResult } from "@/shared/api/hotel-types"
import { type Conversation, useConversation } from "./use-conversation"

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
  const [hotelId, setHotelId] = useState<string>()
  const [factId, setFactId] = useState<string>()
  const [camera, setCamera] = useState<Camera>()
  const [previewRefs, setPreviewRefs] = useState<readonly string[]>()
  const [previewMatch, setPreviewMatch] = useState<MatchedProperty>()
  const [geoRefs, setGeoRefs] = useState<readonly string[]>([])
  const [focusedFact, setFocusedFact] = useState<FactBrief>()
  const [focusedMatch, setFocusedMatch] = useState<MatchedProperty>()
  const [compared, setCompared] = useState<readonly string[]>([])
  const [limitReached, setLimitReached] = useState(false)
  const [view, setView] = useState<WorkspaceView>("chat")
  const detailRef = useRef<HTMLDivElement>(null)
  function clearSelection() {
    setHotelId(undefined)
    setFactId(undefined)
    setCamera(undefined)
    setGeoRefs([])
    setFocusedFact(undefined)
    setPreviewRefs(undefined)
    setPreviewMatch(undefined)
    setFocusedMatch(undefined)
  }
  const chat = useConversation(hotelId, (data: Conversation) => {
    setFactId(undefined)
    setPreviewRefs(undefined)
    setPreviewMatch(undefined)
    setFocusedMatch(undefined)
    if (!data.search?.results.some((item) => item.hotel.id === hotelId)) clearSelection()
  })
  const search = chat.data?.search
  const results = [
    ...new Map((search?.results ?? []).map((result) => [result.hotel.id, result])).values(),
  ]
  const activeSubject = factId ?? hotelId
  useEffect(() => {
    if (activeSubject && view === "hotels" && window.matchMedia(NARROW).matches)
      detailRef.current?.focus()
  }, [activeSubject, view])
  function select(result: SearchResult) {
    clearSelection()
    setHotelId(result.hotel.id)
    setCamera(result.camera)
    setView((current) => (current === "map" ? "map" : "hotels"))
  }
  function property(result: SearchResult, item: MatchedProperty) {
    setHotelId(result.hotel.id)
    setCamera(item.camera ?? result.camera)
    setFactId(undefined)
    setGeoRefs(item.geo_refs ?? item.fact?.geo_refs ?? [])
    setFocusedFact(item.fact ?? undefined)
    setFocusedMatch(item)
    setPreviewMatch(undefined)
    setView("map")
  }
  function fact(item: FactBrief) {
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
    messages: ordered(chat.data?.messages ?? []),
    conversationId: chat.conversationId,
    history: chat.history,
    search,
    outgoing: chat.outgoing,
    send: chat.send,
    retry: chat.retry,
    reset: () => {
      clearSelection()
      setCompared([])
      chat.reset()
      setView("chat")
    },
    renameConversation: chat.rename,
    deleteConversation: (id: string) => {
      if (id === chat.conversationId) {
        clearSelection()
        setCompared([])
      }
      return chat.remove(id)
    },
    openConversation: (id: string) => {
      clearSelection()
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
    hotelId,
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

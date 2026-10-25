import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { api, isApiError, unwrap } from "@/shared/api"
import type { Camera, FactBrief, MatchedProperty, SearchResult } from "@/shared/api/hotel-types"
import type { components } from "@/shared/api/schema.gen"
import { useLocale } from "@/shared/i18n"

type Conversation = components["schemas"]["Conversation"]
const STORAGE_KEY = "hotel-agent-conversation"

export function useHotelWorkspace() {
  const { locale } = useLocale()
  const [conversationId, setConversationId] = useState<string | null>(() =>
    window.localStorage.getItem(STORAGE_KEY),
  )
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
  const [view, setView] = useState("chat")
  const cache = useQueryClient()
  const detailRef = useRef<HTMLElement>(null)
  const conversation = useQuery({
    queryKey: ["conversation", conversationId],
    enabled: conversationId !== null,
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/chat/conversations/{conversation_id}", {
          signal,
          params: { path: { conversation_id: conversationId ?? "" } },
        }),
      ),
    retry: false,
  })
  useEffect(() => {
    if (isApiError(conversation.error, "not_found")) {
      window.localStorage.removeItem(STORAGE_KEY)
      setConversationId(null)
    }
  }, [conversation.error])
  const sendMessage = useMutation({
    mutationFn: (message: string) =>
      unwrap(
        api.POST("/chat/messages", {
          body: {
            conversation_id: conversationId,
            message,
            region_id: "sochi",
            locale,
            selected_hotel_id: hotelId ?? null,
          },
        }),
      ),
    onSuccess: (data: Conversation) => {
      window.localStorage.setItem(STORAGE_KEY, data.id)
      cache.setQueryData(["conversation", data.id], data)
      setConversationId(data.id)
      setFactId(undefined)
      setPreviewRefs(undefined)
      setPreviewMatch(undefined)
      setFocusedMatch(undefined)
      setView("list")
      if (!data.search?.results.some((item) => item.hotel.id === hotelId)) {
        setHotelId(undefined)
        setGeoRefs([])
        setFocusedFact(undefined)
      }
    },
  })
  const data = conversation.data
  const results = data?.search?.results ?? []
  const bounds = data?.search?.viewport?.bbox
  const activeSubject = factId ?? hotelId
  useEffect(() => {
    if (activeSubject && view === "list" && window.matchMedia("(max-width: 63.99rem)").matches)
      detailRef.current?.focus()
  }, [activeSubject, view])
  function select(result: SearchResult) {
    setHotelId(result.hotel.id)
    setCamera(result.camera)
    setFactId(undefined)
    setGeoRefs([])
    setFocusedFact(undefined)
    setPreviewRefs(undefined)
    setPreviewMatch(undefined)
    setFocusedMatch(undefined)
    setView("list")
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
    search: data?.search,
    messages: data?.messages ?? [],
    chatError: conversation.isError || sendMessage.isError,
    send: (message: string) => sendMessage.mutateAsync(message),
    request: data?.effective_query ?? null,
    results,
    bounds: hotelId ? undefined : bounds,
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
    closeFact: () => setFactId(undefined),
    pending: sendMessage.isPending || conversation.isFetching,
  }
}

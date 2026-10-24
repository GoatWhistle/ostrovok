import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { useHotelSearch } from "@/entities/hotel"
import type {
  Camera,
  FactBrief,
  MatchedProperty,
  SearchRequest,
  SearchResult,
} from "@/shared/api/hotel-types"
export function useHotelWorkspace() {
  const [request, setRequest] = useState<SearchRequest | null>(null)
  const [hotelId, setHotelId] = useState<string>()
  const [factId, setFactId] = useState<string>()
  const [camera, setCamera] = useState<Camera>()
  const [previewRefs, setPreviewRefs] = useState<readonly string[]>()
  const [geoRefs, setGeoRefs] = useState<readonly string[]>([])
  const [compared, setCompared] = useState<readonly string[]>([])
  const [limitReached, setLimitReached] = useState(false)
  const [view, setView] = useState("list")
  const search = useHotelSearch(request)
  const cache = useQueryClient()
  const detailRef = useRef<HTMLElement>(null)
  const activeSubject = factId ?? hotelId
  useEffect(() => {
    if (activeSubject && view === "map" && window.matchMedia("(max-width: 63.99rem)").matches)
      detailRef.current?.focus()
  }, [activeSubject, view])
  function select(result: SearchResult) {
    setHotelId(result.hotel.id)
    setCamera(result.camera)
    setFactId(undefined)
    setGeoRefs([])
    setPreviewRefs(undefined)
    setView("map")
  }
  function property(result: SearchResult, item: MatchedProperty) {
    setHotelId(result.hotel.id)
    setCamera(item.camera ?? result.camera)
    setFactId(item.fact?.fact_id)
    setGeoRefs(item.geo_refs ?? item.fact?.geo_refs ?? [])
    setView("map")
  }
  function fact(item: FactBrief) {
    setFactId(item.fact_id)
    setGeoRefs(item.geo_refs ?? [])
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
  function submit(next: SearchRequest) {
    void cache.resetQueries({ queryKey: ["search", next], exact: true })
    setPreviewRefs(undefined)
    setRequest(next)
    setHotelId(undefined)
    setFactId(undefined)
    setCamera(undefined)
    setGeoRefs([])
    setView("list")
  }
  return {
    request,
    detailRef,
    submit,
    hotelId,
    factId,
    camera,
    geoRefs: previewRefs ?? geoRefs,
    preview: (result: SearchResult, item: MatchedProperty | undefined) =>
      setPreviewRefs(
        result.hotel.id === hotelId ? (item?.geo_refs ?? item?.fact?.geo_refs) : undefined,
      ),
    compared,
    compare,
    limitReached,
    view,
    setView,
    select,
    property,
    fact,
    closeFact: () => setFactId(undefined),
    pending: search.isFetching,
  }
}

import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Conversation } from "../../../src/features/hotel-search/use-conversation"
import { useHotelWorkspace } from "../../../src/features/hotel-search/use-hotel-workspace"
import type { MatchedProperty, SearchResult } from "../../../src/shared/api/hotel-types"

const harness = vi.hoisted(() => ({
  answer: (_data: Conversation) => {},
  data: undefined as Conversation | undefined,
}))
vi.mock("../../../src/features/hotel-search/use-conversation", () => ({
  useConversation: (_selected: string | undefined, onAnswer: (data: Conversation) => void) => {
    harness.answer = onAnswer
    return {
      data: harness.data,
      history: [],
      conversationId: "conversation",
      progress: [],
      request: 0,
      sending: false,
      failed: false,
    }
  },
}))

const result: SearchResult = {
  hotel: { id: "h1", name: "Hotel", location: [39.72, 43.58] },
  matched: [],
  score: 0,
}
const property = {
  characteristic_key: "view",
  match: "partial",
  geo_refs: ["g_point"],
} as MatchedProperty
function reply(searchMessageId: string): Conversation {
  return {
    id: "conversation",
    title: "Hotels",
    updated_at: null,
    messages: [
      {
        id: "new-answer",
        role: "assistant",
        content: "Advice",
        created_at: "2026-10-26T09:00:00Z",
      },
    ],
    search_message_id: searchMessageId,
    search: { query_id: "q", parsed: {}, results: [result] },
  }
}

function Wrapper({ children }: { readonly children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>
}

beforeEach(() => {
  harness.data = undefined
})
describe("consultation in the hotel workspace", () => {
  it("keeps the selected hotel and focused map property when advice preserves the search", () => {
    const state = renderHook(() => useHotelWorkspace(), { wrapper: Wrapper })
    act(() => state.result.current.property(result, property))
    expect(state.result.current.hotelId).toBe("h1")
    act(() => harness.answer(reply("old-search-answer")))
    expect(state.result.current.hotelId).toBe("h1")
    expect(state.result.current.focusProperty).toBe(property)
    expect(state.result.current.geoRefs).toEqual(["g_point"])
  })
  it("updates selection after an actual new search", () => {
    const state = renderHook(() => useHotelWorkspace(), { wrapper: Wrapper })
    act(() => state.result.current.property(result, property))
    const data = reply("new-answer")
    data.search = { query_id: "new", parsed: {}, results: [] }
    act(() => harness.answer(data))
    expect(state.result.current.hotelId).toBeUndefined()
    expect(state.result.current.focusProperty).toBeUndefined()
  })
})

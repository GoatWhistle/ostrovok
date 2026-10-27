import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { MemoryRouter, useLocation, useNavigate } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Conversation } from "@/features/hotel-search"
import { useHotelWorkspace } from "@/features/hotel-search/use-hotel-workspace"
import { api } from "@/shared/api"
import { LocaleProvider } from "@/shared/i18n"

function conversation(id: string, hotel: string): Conversation {
  return {
    id,
    title: id,
    updated_at: null,
    messages: [
      { id: `${id}-user`, role: "user", content: "A hotel", created_at: "2026-10-27T00:00:00Z" },
      {
        id: `${id}-reply`,
        role: "assistant",
        content: "Found",
        created_at: "2026-10-27T00:00:01Z",
      },
    ],
    search_message_id: `${id}-reply`,
    search: {
      query_id: id,
      parsed: {},
      results: [
        { hotel: { id: hotel, name: hotel, location: [39.72, 43.58] }, matched: [], score: 0 },
      ],
    },
  }
}

function deferredChat() {
  const sent: string[] = []
  let push: ((data: Conversation) => void) | undefined
  const send = vi.fn((_url: string, init?: RequestInit) => {
    sent.push(String((JSON.parse(String(init?.body)) as { message: string }).message))
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        push = (data) => {
          const frame = `event: result\ndata: ${JSON.stringify(data)}\n\n`
          controller.enqueue(new TextEncoder().encode(frame))
          controller.close()
        }
      },
    })
    return Promise.resolve(
      new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } }),
    )
  })
  vi.stubGlobal("fetch", send)
  return { sent, send, finish: (data: Conversation) => push?.(data) }
}

function mount(initial: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[initial]}>
        <QueryClientProvider client={client}>
          <LocaleProvider>{children}</LocaleProvider>
        </QueryClientProvider>
      </MemoryRouter>
    )
  }
  return renderHook(
    () => ({ workspace: useHotelWorkspace(), location: useLocation(), navigate: useNavigate() }),
    { wrapper: Wrapper },
  )
}

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: false }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  localStorage.clear()
})

describe("conversation navigation", () => {
  it("opens a linked conversation with empty local history through GET only", async () => {
    const data = conversation("chat-direct", "hotel-a")
    const get = vi
      .spyOn(api, "GET")
      .mockResolvedValue({ data, response: new Response("{}") } as never)
    const post = vi.spyOn(api, "POST")
    const state = mount("/?chat=chat-direct")
    await waitFor(() => expect(state.result.current.workspace.results).toHaveLength(1))
    expect(get).toHaveBeenCalledWith(
      "/chat/conversations/{conversation_id}",
      expect.objectContaining({ params: { path: { conversation_id: "chat-direct" } } }),
    )
    expect(state.result.current.workspace.conversationId).toBe("chat-direct")
    expect(post).not.toHaveBeenCalled()
  })

  it("keeps a late answer in its own conversation without replacing the open conversation", async () => {
    const first = conversation("chat-a", "hotel-a")
    const second = conversation("chat-b", "hotel-b")
    vi.spyOn(api, "GET").mockImplementation((_path, options) =>
      Promise.resolve({
        data:
          (options as { params: { path: { conversation_id: string } } }).params.path
            .conversation_id === "chat-a"
            ? first
            : second,
        response: new Response("{}"),
      } as never),
    )
    const chat = deferredChat()
    const state = mount("/?chat=chat-a")
    await waitFor(() => expect(state.result.current.workspace.results[0]?.hotel.id).toBe("hotel-a"))
    act(() => {
      state.result.current.workspace.send("New conditions")
      state.result.current.workspace.send("Accidental duplicate")
    })
    await waitFor(() => expect(chat.send).toHaveBeenCalledTimes(1))
    act(() => state.result.current.workspace.openConversation("chat-b"))
    await waitFor(() => expect(state.result.current.workspace.results[0]?.hotel.id).toBe("hotel-b"))
    await act(async () => {
      chat.finish(conversation("chat-a", "hotel-late"))
      await Promise.resolve()
    })
    expect(state.result.current.workspace.conversationId).toBe("chat-b")
    expect(state.result.current.workspace.results[0]?.hotel.id).toBe("hotel-b")
    expect(state.result.current.location.search).toContain("chat=chat-b")
  })

  it("opens the answer that arrives after a return to the landing", async () => {
    const answer = conversation("chat-late", "hotel-late")
    vi.spyOn(api, "GET").mockResolvedValue({ data: answer, response: new Response("{}") } as never)
    const chat = deferredChat()
    const state = mount("/")
    act(() => state.result.current.workspace.send("A hotel by the sea"))
    await waitFor(() => expect(state.result.current.workspace.sending).toBe(true))
    await act(async () => {
      await state.result.current.navigate("/", { state: { draftId: "other" } })
    })
    expect(state.result.current.workspace.surface).toBe("landing")
    await act(async () => {
      chat.finish(answer)
      await Promise.resolve()
    })
    await waitFor(() => expect(state.result.current.workspace.conversationId).toBe("chat-late"))
    expect(state.result.current.workspace.results[0]?.hotel.id).toBe("hotel-late")
    expect(state.result.current.location.search).toContain("chat=chat-late")
  })

  it("restores hotel selection with Back without another search", async () => {
    vi.spyOn(api, "GET").mockResolvedValue({
      data: conversation("chat-a", "hotel-a"),
      response: new Response("{}"),
    } as never)
    const post = vi.spyOn(api, "POST")
    const state = mount("/?chat=chat-a")
    await waitFor(() => expect(state.result.current.workspace.results).toHaveLength(1))
    const hotel = state.result.current.workspace.results[0]
    if (!hotel) throw new Error("Expected hotel")
    act(() => state.result.current.workspace.select(hotel))
    expect(state.result.current.location.search).toContain("hotel=hotel-a")
    act(() => state.result.current.workspace.navigation.expandMap())
    expect(state.result.current.location.search).toContain("map=full")
    await act(async () => {
      await state.result.current.navigate(-1)
    })
    expect(state.result.current.workspace.hotelId).toBe("hotel-a")
    expect(state.result.current.workspace.navigation.route.fullMap).toBe(false)
    expect(post).not.toHaveBeenCalled()
  })

  it("keeps a missing linked conversation in an explicit error state", async () => {
    vi.spyOn(api, "GET").mockResolvedValue({
      error: { code: "not_found", message: "Missing" },
      response: new Response("{}", { status: 404 }),
    } as never)
    const state = mount("/?chat=missing")
    await waitFor(() => expect(state.result.current.workspace.chatFailed).toBe(true))
    expect(state.result.current.workspace.conversationId).toBe("missing")
    expect(state.result.current.workspace.navigation.started).toBe(true)
  })
})

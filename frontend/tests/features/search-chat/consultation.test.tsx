import { render, screen, within } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { SearchChat, type SearchChatProps } from "../../../src/features/search-chat/search-chat"
import { createI18n, LocaleProvider } from "../../../src/shared/i18n"

const props: SearchChatProps = {
  messages: [
    {
      id: "search-answer",
      role: "assistant",
      content: "Found hotels",
      created_at: "2026-10-26T09:00:00Z",
    },
    {
      id: "consult-answer",
      role: "assistant",
      content: "Advice about your trip",
      created_at: "2026-10-26T09:01:00Z",
    },
  ],
  conversationId: "conversation",
  history: [],
  view: "chat",
  outgoing: undefined,
  searchMessageId: "search-answer",
  search: {
    query_id: "q",
    parsed: { location_hint: "Sochi" },
    results: [
      { hotel: { id: "h1", name: "Hotel", location: [39.72, 43.58] }, score: 1, matched: [] },
    ],
  },
  loading: false,
  sending: false,
  failed: false,
  onSend: vi.fn(),
  onRetry: vi.fn(),
  onShowOnMap: vi.fn(),
  onShowList: vi.fn(),
  onReset: vi.fn(),
  onOpenConversation: vi.fn(),
  onView: vi.fn(),
  onRename: vi.fn(),
  onDelete: vi.fn(),
}
afterEach(() => vi.unstubAllGlobals())
it.each(["ru", "en"] as const)(
  "keeps search controls on the search reply after consultation (%s)",
  (locale) => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    )
    const instance = createI18n()
    void instance.changeLanguage(locale)
    render(
      <LocaleProvider instance={instance}>
        <SearchChat {...props} />
      </LocaleProvider>,
    )
    const search = screen.getByText("Found hotels").closest("li")
    const advice = screen.getByText("Advice about your trip").closest("li")
    expect(search).not.toBeNull()
    expect(advice).not.toBeNull()
    if (!search || !advice) throw new Error("Chat messages are missing")
    expect(within(search).getAllByRole("button").length).toBeGreaterThan(0)
    expect(within(advice).queryByRole("button")).toBeNull()
  },
)

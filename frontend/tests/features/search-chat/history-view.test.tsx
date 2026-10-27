import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { SearchChat, type SearchChatProps } from "../../../src/features/search-chat/search-chat"
import { createI18n, LocaleProvider } from "../../../src/shared/i18n"
import ru from "../../../src/shared/i18n/locales/ru/explore.json"

const props: SearchChatProps = {
  messages: [],
  conversationId: null,
  history: [{ id: "chat-a", title: "A hotel by the sea" }],
  view: "history",
  outgoing: undefined,
  searchMessageId: null,
  search: undefined,
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

function show(overrides: Partial<SearchChatProps> = {}) {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  )
  return render(
    <LocaleProvider instance={createI18n("ru")}>
      <SearchChat {...props} {...overrides} />
    </LocaleProvider>,
  )
}

afterEach(() => vi.unstubAllGlobals())

describe("chat history view", () => {
  it("leaves a way back to a new search while the history is open", async () => {
    const onView = vi.fn()
    const onReset = vi.fn()
    show({ onView, onReset })

    const create = screen.getByRole("button", { name: ru.chat.newSearch })
    expect(create.hasAttribute("disabled")).toBe(false)
    await userEvent.click(create)

    expect(onView).toHaveBeenCalledWith("chat")
    expect(onReset).toHaveBeenCalled()
  })

  it("keeps the empty new search disabled while the chat itself is open", () => {
    show({ view: "chat" })

    expect(screen.getByRole("button", { name: ru.chat.newSearch }).hasAttribute("disabled")).toBe(
      true,
    )
  })
})

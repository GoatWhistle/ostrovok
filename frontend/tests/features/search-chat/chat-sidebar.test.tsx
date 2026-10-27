import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  ChatSidebar,
  type ChatSidebarProps,
} from "../../../src/features/search-chat/sidebar/chat-sidebar"
import { createI18n, LocaleProvider } from "../../../src/shared/i18n"
import ru from "../../../src/shared/i18n/locales/ru/explore.json"

const today = new Date().toISOString()

function show(overrides: Partial<ChatSidebarProps> = {}) {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  )
  const props: ChatSidebarProps = {
    activeId: "chat-a",
    collapsed: false,
    conversations: [
      { id: "chat-a", title: "Quiet hotel by the sea", updatedAt: today },
      { id: "chat-b", title: "Sunset view", updatedAt: "2020-01-01T10:00:00Z" },
    ],
    onToggle: vi.fn(),
    onNew: vi.fn(),
    onOpen: vi.fn(),
    onRename: vi.fn(() => Promise.resolve()),
    onDelete: vi.fn(() => Promise.resolve()),
    ...overrides,
  }
  render(
    <LocaleProvider instance={createI18n("ru")}>
      <ChatSidebar {...props} />
    </LocaleProvider>,
  )
  return props
}

afterEach(() => vi.unstubAllGlobals())

describe("chat sidebar", () => {
  it("lists chats by day and marks the current one", () => {
    show()
    const nav = screen.getByRole("navigation", { name: ru.chat.chats })
    expect(within(nav).getByText(ru.chat.groupToday)).toBeTruthy()
    expect(within(nav).getByText(ru.chat.groupEarlier)).toBeTruthy()
    const current = within(nav).getByRole("button", { name: "Quiet hotel by the sea" })
    expect(current.getAttribute("aria-current")).toBe("page")
  })

  it("opens a chat and starts a new one", async () => {
    const props = show()
    await userEvent.click(screen.getByRole("button", { name: "Sunset view" }))
    expect(props.onOpen).toHaveBeenCalledWith("chat-b")
    await userEvent.click(screen.getByRole("button", { name: ru.chat.newSearch }))
    expect(props.onNew).toHaveBeenCalled()
  })

  it("asks before deleting a chat", async () => {
    const props = show()
    const row = screen.getByRole("button", { name: "Sunset view" }).closest("li")
    if (!row) throw new Error("Row is missing")
    await userEvent.click(within(row).getByRole("button", { name: ru.chat.delete }))
    expect(props.onDelete).not.toHaveBeenCalled()
    const prompt = screen.getByText(ru.chat.deleteConfirm.replace("{{title}}", "Sunset view"))
    const confirm = prompt.closest("li")
    if (!confirm) throw new Error("Confirmation is missing")
    await userEvent.click(within(confirm).getByRole("button", { name: ru.chat.delete }))
    expect(props.onDelete).toHaveBeenCalledWith("chat-b")
  })

  it("collapses to a rail with the toggle and a new chat action", async () => {
    const props = show({ collapsed: true })
    const toggle = screen.getByRole("button", { name: ru.chat.sidebarOpen })
    expect(toggle.getAttribute("aria-expanded")).toBe("false")
    expect(screen.queryByRole("button", { name: "Sunset view" })).toBeNull()
    await userEvent.click(toggle)
    expect(props.onToggle).toHaveBeenCalled()
    expect(screen.getByRole("button", { name: ru.chat.newSearch })).toBeTruthy()
  })
})

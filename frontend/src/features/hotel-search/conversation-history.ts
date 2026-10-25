export interface SavedConversation {
  readonly id: string
  readonly title: string
}

const HISTORY_KEY = "hotel-agent-conversations"
const ACTIVE_KEY = "hotel-agent-conversation"

export function readActiveConversation(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_KEY)
  } catch {
    return null
  }
}

export function saveActiveConversation(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(ACTIVE_KEY, id)
    else window.localStorage.removeItem(ACTIVE_KEY)
  } catch {
    return
  }
}

export function readConversationHistory(): SavedConversation[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    const entries = Array.isArray(parsed)
      ? parsed.filter(
          (item): item is SavedConversation =>
            typeof item === "object" &&
            item !== null &&
            typeof item.id === "string" &&
            typeof item.title === "string",
        )
      : []
    const active = readActiveConversation()
    if (active && !entries.some((item) => item.id === active))
      return [{ id: active, title: "" }, ...entries]
    return entries
  } catch {
    return []
  }
}

export function saveConversationHistory(entries: readonly SavedConversation[]): void {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries))
  } catch {
    return
  }
}

export function rememberConversation(
  entries: readonly SavedConversation[],
  id: string,
  firstMessage: string,
): SavedConversation[] {
  const existing = entries.find((item) => item.id === id)
  const title = existing?.title || firstMessage.trim().replace(/\s+/g, " ").slice(0, 80)
  return [{ id, title }, ...entries.filter((item) => item.id !== id)]
}

import { beforeEach, describe, expect, it } from "vitest"
import {
  readActiveConversation,
  readConversationHistory,
  rememberConversation,
  saveActiveConversation,
  saveConversationHistory,
} from "../../../src/features/hotel-search/conversation-history"

describe("conversation history", () => {
  beforeEach(() => window.localStorage.clear())

  it("keeps previous chats when starting a new search", () => {
    saveActiveConversation("first")
    const history = rememberConversation([], "first", "  Hotel  by the sea ")
    saveConversationHistory(history)
    saveActiveConversation(null)

    expect(readActiveConversation()).toBeNull()
    expect(readConversationHistory()).toEqual([{ id: "first", title: "Hotel by the sea" }])
  })

  it("restores an existing single chat and rejects malformed history", () => {
    saveActiveConversation("legacy")
    expect(readConversationHistory()).toEqual([{ id: "legacy", title: "" }])
    window.localStorage.setItem("hotel-agent-conversations", "not-json")
    expect(readConversationHistory()).toEqual([])
  })
})

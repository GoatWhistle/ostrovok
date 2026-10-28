import { describe, expect, it } from "vitest"
import { groupHistory } from "../../../../src/features/search-chat/sidebar/history-groups"

const now = new Date(2026, 9, 27, 15, 0)
const at = (day: number, hour: number) => new Date(2026, 9, day, hour).toISOString()

describe("chat history groups", () => {
  it("orders chats newest first and splits them into today, yesterday and earlier", () => {
    const sections = groupHistory(
      [
        { id: "old", title: "Old", updatedAt: at(20, 10) },
        { id: "morning", title: "Morning", updatedAt: at(27, 9) },
        { id: "late", title: "Late", updatedAt: at(26, 23) },
        { id: "noon", title: "Noon", updatedAt: at(27, 12) },
      ],
      now,
    )
    expect(sections.map((section) => section.group)).toEqual(["today", "yesterday", "earlier"])
    expect(sections[0]?.entries.map((entry) => entry.id)).toEqual(["noon", "morning"])
    expect(sections[1]?.entries.map((entry) => entry.id)).toEqual(["late"])
    expect(sections[2]?.entries.map((entry) => entry.id)).toEqual(["old"])
  })

  it("keeps a chat without a timestamp on top of today", () => {
    const sections = groupHistory(
      [
        { id: "dated", title: "Dated", updatedAt: at(27, 8) },
        { id: "pending", title: "" },
      ],
      now,
    )
    expect(sections).toHaveLength(1)
    expect(sections[0]?.entries.map((entry) => entry.id)).toEqual(["pending", "dated"])
  })

  it("drops empty groups", () => {
    expect(groupHistory([], now)).toEqual([])
  })
})

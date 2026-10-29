import { describe, expect, it } from "vitest"
import { backgroundReplyId } from "@/features/hotel-search/background-replies"

const message = (id: string, role: "user" | "assistant", minute: number) => ({
  id,
  role,
  content: id,
  created_at: `2026-10-29T09:${String(minute).padStart(2, "0")}:00Z`,
})

describe("background replies", () => {
  it("finds an assistant reply that arrived without a new user message", () => {
    expect(
      backgroundReplyId([
        message("owner", "assistant", 9),
        message("asked", "user", 1),
        message("queued", "assistant", 2),
      ]),
    ).toBe("owner")
  })

  it("orders a question before its reply when both share a timestamp", () => {
    expect(
      backgroundReplyId([
        message("queued", "assistant", 2),
        message("asked", "user", 2),
        message("owner", "assistant", 9),
      ]),
    ).toBe("owner")
    expect(
      backgroundReplyId([message("queued", "assistant", 2), message("asked", "user", 2)]),
    ).toBe(undefined)
  })

  it("ignores the usual question and answer turn", () => {
    expect(
      backgroundReplyId([message("asked", "user", 1), message("queued", "assistant", 2)]),
    ).toBe(undefined)
    expect(backgroundReplyId(undefined)).toBe(undefined)
  })
})

import { describe, expect, it } from "vitest"
import { progressView } from "../../../src/features/search-chat/progress/progress-view"
import type { ChatProgress } from "../../../src/shared/api"

const parsed: ChatProgress = {
  stage: "parsed",
  location: "Sochi",
  intents: [
    { term: "quiet", key: "noise_level" },
    { term: "by the sea", key: "distance_to_sea" },
  ],
  check_in: "2026-11-12",
  check_out: "2026-11-15",
  adults: 2,
}

describe("search progress view", () => {
  it("starts on the first step with nothing understood yet", () => {
    const view = progressView([])
    expect(view.step).toBe(0)
    expect(view.wishes).toEqual([])
    expect(view.location).toBeUndefined()
  })

  it("lists the understood wishes as queued until research starts", () => {
    const view = progressView([{ stage: "parsing" }, parsed])
    expect(view.step).toBe(1)
    expect(view.location).toBe("Sochi")
    expect(view.adults).toBe(2)
    expect(view.wishes.map((wish) => wish.state)).toEqual(["queued", "queued"])
  })

  it("marks wishes as checking and then applies each verdict", () => {
    const view = progressView([
      parsed,
      { stage: "candidates", found: 20 },
      { stage: "research", wishes: 2 },
      { stage: "wish", term: "Quiet ", status: "matched" },
    ])
    expect(view.step).toBe(2)
    expect(view.wishes.map((wish) => [wish.term, wish.state])).toEqual([
      ["quiet", "verified"],
      ["by the sea", "checking"],
    ])
  })

  it("adds checked terms the parser did not report and maps every status", () => {
    const view = progressView([
      { stage: "research", wishes: 3 },
      { stage: "wish", term: "pets", status: "exhausted" },
      { stage: "wish", term: "view", status: "needs_input" },
      { stage: "wish", term: "bars", status: "unavailable" },
      { stage: "review" },
    ])
    expect(view.step).toBe(3)
    expect(view.wishes.map((wish) => wish.state)).toEqual(["missing", "partial", "unknown"])
  })
})

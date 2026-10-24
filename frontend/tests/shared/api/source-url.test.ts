import { describe, expect, it } from "vitest"
import { sourceUrl } from "@/shared/api/source-url"

describe("source citations", () => {
  it.each([
    "javascript:alert(1)",
    "data:text/html,unsafe",
    "/relative",
    "file:///tmp/data",
    null,
    undefined,
  ])("does not expose an unsafe href %s", (value) => {
    expect(sourceUrl(value)).toBeUndefined()
  })
  it("keeps an external evidence URL", () => {
    expect(sourceUrl("https://www.openstreetmap.org/way/1")).toBe(
      "https://www.openstreetmap.org/way/1",
    )
  })
})

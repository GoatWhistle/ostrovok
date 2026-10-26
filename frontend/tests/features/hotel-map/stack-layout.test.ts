import { describe, expect, it } from "vitest"
import { spiderOffsets, stackGroups } from "../../../src/features/hotel-map/markers/stack-layout"

describe("overlapping hotel markers", () => {
  it("only groups hotels closer than eight screen pixels", () => {
    expect(
      stackGroups([
        { x: 0, y: 0 },
        { x: 3, y: 4 },
        { x: 9, y: 0 },
      ]),
    ).toEqual([[0, 1], [2]])
  })

  it.each([2, 5, 20])("spreads %s hotels beyond a touch target", (count) => {
    const points = spiderOffsets(count)
    for (const [index, point] of points.entries()) {
      for (const next of points.slice(index + 1)) {
        expect(Math.hypot(next[0] - point[0], next[1] - point[1])).toBeGreaterThanOrEqual(44)
      }
    }
  })
})

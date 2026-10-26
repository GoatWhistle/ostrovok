import { describe, expect, it } from "vitest"
import { type LabelItem, layoutLabels } from "../../../src/features/hotel-map/markers/label-layout"

const bounds = { x: 0, y: 0, width: 400, height: 300 }
const item: LabelItem = {
  id: "hotel",
  priority: 100,
  anchor: { x: 150, y: 150, width: 32, height: 32 },
  size: { width: 100, height: 30 },
  candidates: ["end", "start", "top", "bottom"],
}

describe("map label collision layout", () => {
  it("changes side at the edge of the map", () => {
    expect(
      layoutLabels([{ ...item, anchor: { ...item.anchor, x: 350 } }], bounds, []).get("hotel"),
    ).toBe("start")
  })
  it("reserves preferred labels before lower priority labels", () => {
    const low: LabelItem = { ...item, id: "place", priority: 10, candidates: ["end"] }
    const result = layoutLabels([low, item], bounds, [])
    expect(result.get("hotel")).toBe("end")
    expect(result.get("place")).toBe("hidden")
  })
  it("hides a label if panels and pins leave no room", () => {
    expect(layoutLabels([item], bounds, [bounds]).get("hotel")).toBe("hidden")
  })
  it("keeps a valid previous side through a one-pixel camera move", () => {
    expect(
      layoutLabels(
        [{ ...item, previous: "top", anchor: { ...item.anchor, x: 151 } }],
        bounds,
        [],
      ).get("hotel"),
    ).toBe("top")
  })
})

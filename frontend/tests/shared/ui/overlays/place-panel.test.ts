import { describe, expect, it } from "vitest"
import { placePanel } from "@/shared/ui/overlays/popover/use-popover"

const bounds = { left: 480, top: 64, right: 1440, bottom: 900 }
const anchor = { left: 1380, top: 412, bottom: 468, height: 56 }
const box = { width: 320, height: 480 }

describe("placePanel", () => {
  it("opens beside the trigger and stays inside the boundary", () => {
    const position = placePanel(anchor, box, "start", bounds, 8)
    expect(position.left).toBe(1380 - 320 - 8)
    expect(position.top).toBeGreaterThanOrEqual(64 + 8)
    expect(position.top + box.height).toBeLessThanOrEqual(900 - 8)
  })

  it("falls back to opening above when there is no room beside", () => {
    const narrow = { left: 0, top: 64, right: 375, bottom: 812 }
    const phone = { left: 315, top: 400, bottom: 456, height: 56 }
    const position = placePanel(phone, { width: 343, height: 300 }, "start", narrow, 8)
    expect(position.top).toBe(400 - 300 - 8)
    expect(position.left).toBe(375 - 343 - 8)
  })

  it("keeps top placement clamped below the boundary top", () => {
    const position = placePanel(anchor, box, "top", bounds, 8)
    expect(position.top).toBe(72)
  })

  it("aligns the right edge with the trigger for bottom-end", () => {
    const trigger = { left: 340, right: 364, top: 100, bottom: 124, height: 24 }
    const wide = { left: 0, top: 0, right: 1440, bottom: 900 }
    const position = placePanel(trigger, { width: 300, height: 200 }, "bottom-end", wide, 8)
    expect(position.left).toBe(64)
    expect(position.top).toBe(132)
  })
})

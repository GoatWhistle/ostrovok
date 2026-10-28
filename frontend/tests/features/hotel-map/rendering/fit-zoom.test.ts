import { describe, expect, it } from "vitest"
import {
  CAMERA_MAX_ZOOM,
  cameraZoom,
  FIT_MAX_ZOOM,
  fitOptions,
} from "@/features/hotel-map/rendering/fit-zoom"

describe("fitOptions", () => {
  it("caps a fit without its own limit so one hotel does not zoom into the ground", () => {
    expect(fitOptions({ padding: 48 })).toEqual({ padding: 48, maxZoom: FIT_MAX_ZOOM })
  })

  it("never lets a caller exceed the cap but keeps a lower limit", () => {
    expect(fitOptions({ maxZoom: 20 }).maxZoom).toBe(FIT_MAX_ZOOM)
    expect(fitOptions({ maxZoom: 15 }).maxZoom).toBe(15)
  })

  it("clamps server cameras that ask for an extreme zoom", () => {
    expect(cameraZoom(17)).toBe(17)
    expect(cameraZoom(24)).toBe(CAMERA_MAX_ZOOM)
  })
})

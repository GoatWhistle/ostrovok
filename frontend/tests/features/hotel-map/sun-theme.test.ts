import { describe, expect, it } from "vitest"
import { sunTheme } from "../../../src/features/hotel-map/scene-time/use-sun-theme"

describe("theme follows the sun", () => {
  it("turns light when the sun is up", () => {
    expect(sunTheme(0.6, "dark")).toBe("light")
  })

  it("turns dark once the sun is well below the horizon", () => {
    expect(sunTheme(-0.4, "light")).toBe("dark")
  })

  it("keeps the current theme inside twilight so it does not flicker", () => {
    expect(sunTheme(-0.02, "light")).toBe("light")
    expect(sunTheme(-0.02, "dark")).toBe("dark")
  })
})

import { describe, expect, it } from "vitest"
import { weatherIcon } from "../../../src/features/hotel-map/scene-time/weather-icon"

describe("weather symbols", () => {
  it("follows sunlight for clear and partly cloudy skies", () => {
    expect(weatherIcon(0, 10)).toBe("theme-light")
    expect(weatherIcon(1, -10)).toBe("theme-dark")
    expect(weatherIcon(2, 10)).toBe("cloud-sun")
    expect(weatherIcon(2, -10)).toBe("cloud-moon")
  })

  it.each([
    [3, "cloud"],
    [48, "cloud-fog"],
    [57, "cloud-rain"],
    [82, "cloud-rain"],
    [77, "cloud-snow"],
    [86, "cloud-snow"],
    [99, "cloud-lightning"],
    [undefined, "theme-light"],
    [null, "theme-light"],
    [42, "theme-light"],
  ] as const)("maps code %s without guessing unavailable conditions", (code, icon) => {
    expect(weatherIcon(code, -10)).toBe(icon)
  })
})

import { describe, expect, it } from "vitest"
import { QualityGovernor, type QualityLevel, windowDensity } from "@/shared/geo/map-quality"

const WINDOW = 120

function feed(governor: QualityGovernor, frameMs: number, windows: number) {
  for (let index = 0; index < WINDOW * windows; index += 1) governor.sample(frameMs)
}

describe("QualityGovernor", () => {
  it("steps down only after two slow windows in a row", () => {
    const changes: QualityLevel[] = []
    const governor = new QualityGovernor((level) => changes.push(level))
    feed(governor, 40, 1)
    expect(changes).toEqual([])
    feed(governor, 40, 1)
    expect(changes).toEqual([1])
    feed(governor, 40, 6)
    expect(changes).toEqual([1, 2, 3])
  })

  it("needs four fast windows to step back up, so it does not flap", () => {
    const changes: QualityLevel[] = []
    const governor = new QualityGovernor((level) => changes.push(level))
    feed(governor, 40, 2)
    feed(governor, 10, 3)
    expect(governor.level).toBe(1)
    feed(governor, 40, 1)
    feed(governor, 10, 3)
    expect(governor.level).toBe(1)
    feed(governor, 10, 1)
    expect(changes).toEqual([1, 0])
  })

  it("ignores stalls longer than a quarter second and middling frame rates", () => {
    const governor = new QualityGovernor(() => undefined)
    feed(governor, 900, 4)
    feed(governor, 20, 4)
    expect(governor.level).toBe(0)
  })
})

describe("windowDensity", () => {
  it("halves window lights first and turns them off from level two", () => {
    expect([0, 1, 2, 3].map((level) => windowDensity(level as QualityLevel))).toEqual([
      1, 0.5, 0, 0,
    ])
  })
})

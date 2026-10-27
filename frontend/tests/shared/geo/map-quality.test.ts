import { describe, expect, it } from "vitest"
import { QualityGovernor, type QualityLevel, windowDensity } from "@/shared/geo/map-quality"

function framesPerWindow(frameMs: number) {
  return Math.min(120, Math.max(8, Math.ceil(1000 / frameMs)))
}

function feed(governor: QualityGovernor, frameMs: number, windows: number) {
  const frames = framesPerWindow(frameMs) * windows
  for (let index = 0; index < frames; index += 1) governor.sample(frameMs)
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

  it("ignores isolated pauses and middling frame rates", () => {
    const governor = new QualityGovernor(() => undefined)
    governor.sample(900)
    feed(governor, 20, 4)
    expect(governor.level).toBe(0)
  })
})

describe("adaptation speed", () => {
  it("reacts to a slow device within about two seconds of movement", () => {
    const changes: QualityLevel[] = []
    const governor = new QualityGovernor((level) => changes.push(level))
    for (let index = 0; index < 13; index += 1) governor.sample(80)
    expect(changes).toEqual([])
    for (let index = 0; index < 13; index += 1) governor.sample(80)
    expect(changes).toEqual([1])
  })

  it("still waits for a full window on a fast device", () => {
    const governor = new QualityGovernor(() => undefined)
    for (let index = 0; index < 50; index += 1) governor.sample(16)
    expect(governor.level).toBe(0)
  })
})

describe("sustained rendering stalls", () => {
  it("degrades when every moving frame takes almost a second", () => {
    const changes: QualityLevel[] = []
    const governor = new QualityGovernor((level) => changes.push(level))
    for (let index = 0; index < 8; index += 1) governor.sample(900)
    expect(changes).toEqual([1])
    for (let index = 0; index < 16; index += 1) governor.sample(900)
    expect(changes).toEqual([1, 2, 3])
  })

  it("does not mistake isolated loading pauses for sustained stutter", () => {
    const governor = new QualityGovernor(() => undefined)
    for (let index = 0; index < 10; index += 1) {
      governor.sample(900)
      governor.sample(16)
    }
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

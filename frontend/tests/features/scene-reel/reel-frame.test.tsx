import { beforeEach, describe, expect, it } from "vitest"
import { reelFrame, stillFrame } from "@/features/scene-reel/playback/reel-frame"
import { reelTiming } from "@/features/scene-reel/playback/timing"
import { along, HOTEL, ROUTE, SHOTS } from "@/features/scene-reel/shots"
import { motionCurve } from "@/shared/motion"
import { applyMotionTokens } from "../../setup/motionEnvironment"

beforeEach(applyMotionTokens)
const frameAt = (elapsed: number, compact = false) =>
  reelFrame(elapsed, reelTiming(), compact, motionCurve("--ease-out"))

describe("proof reel timing", () => {
  it("plays one shot per proof and loops", () => {
    const { shot } = reelTiming()
    expect(SHOTS.map((item) => item.kind)).toEqual(["sea", "sunset", "quiet"])
    expect(frameAt(0).index).toBe(0)
    expect(frameAt(shot).index).toBe(1)
    expect(frameAt(shot * 2).index).toBe(2)
    expect(frameAt(shot * 3).index).toBe(0)
  })
  it("draws each proof after the camera arrives and fades it before the next shot", () => {
    const { shot, flight, fade, draw, label } = reelTiming()
    expect(frameAt(flight - fade).proofs.sea.draw).toBe(0)
    expect(frameAt(flight - fade + draw).proofs.sea).toMatchObject({ draw: 1, label: 0 })
    expect(frameAt(flight - fade + draw + label).proofs.sea).toMatchObject({ draw: 1, label: 1 })
    expect(frameAt(shot - 1).proofs.sea.opacity).toBeLessThan(0.05)
    expect(frameAt(shot + flight - fade + draw).proofs).toMatchObject({
      sea: { opacity: 0, done: true },
      sunset: { draw: 1, done: true },
      quiet: { draw: 0, done: false },
    })
  })
  it("passes every shot keyframe and moves the camera without jumps", () => {
    const { shot, flight } = reelTiming()
    const first = SHOTS[0]
    const last = SHOTS[2]
    expect(frameAt(flight).camera.bearing).toBeCloseTo(first?.from.bearing ?? 0, 6)
    expect(frameAt(shot * 3).camera.bearing).toBeCloseTo(last?.to.bearing ?? 0, 6)
    for (let time = 0; time < shot * 3; time += 50) {
      const step = Math.abs(frameAt(time + 50).camera.bearing - frameAt(time).camera.bearing)
      expect(step).toBeLessThan(2)
    }
  })
  it("keeps every label fully visible for at least three seconds", () => {
    const { shot, flight, fade, draw, label } = reelTiming()
    expect(shot - fade - (flight - fade + draw + label)).toBeGreaterThanOrEqual(3000)
    expect(shot * SHOTS.length).toBeLessThanOrEqual(20000)
  })
  it("pulls the camera back on narrow screens", () => {
    expect(frameAt(1000, true).camera.zoom).toBeLessThan(frameAt(1000).camera.zoom)
  })
  it("shows every proof in the reduced motion still", () => {
    const still = stillFrame(false)
    expect(Object.values(still.proofs).every((proof) => proof.draw === 1)).toBe(true)
  })
})

describe("route geometry", () => {
  it("walks from the hotel to the shore", () => {
    expect(along(ROUTE, 0)).toEqual(HOTEL)
    expect(along(ROUTE, 1)).toEqual(ROUTE[ROUTE.length - 1])
  })
})

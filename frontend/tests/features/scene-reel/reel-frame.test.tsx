import { render } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { reelFrame, stillFrame } from "@/features/scene-reel/playback/reel-frame"
import { reelTiming } from "@/features/scene-reel/playback/timing"
import { along, HOTEL, ROUTE, SHOTS } from "@/features/scene-reel/shots"
import { TypedText } from "@/features/scene-reel/story/typed-text"
import styles from "@/features/scene-reel/story/typed-text.module.css"
import { motionCurve } from "@/shared/motion"
import { applyMotionTokens } from "../../setup/motionEnvironment"

beforeEach(applyMotionTokens)
const frameAt = (elapsed: number, compact = false) =>
  reelFrame(elapsed, reelTiming(), compact, motionCurve("--ease-out"), motionCurve("--ease-fold"))

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
    const { shot, flight, fade, draw } = reelTiming()
    expect(frameAt(flight - fade).proofs.sea.draw).toBe(0)
    expect(frameAt(flight - fade + draw).proofs.sea).toMatchObject({ draw: 1, label: 1 })
    expect(frameAt(shot - 1).proofs.sea.opacity).toBeLessThan(0.05)
    expect(frameAt(shot + flight - fade + draw).proofs).toMatchObject({
      sea: { opacity: 0, done: true },
      sunset: { draw: 1, done: true },
      quiet: { draw: 0, done: false },
    })
  })
  it("starts at the first shot without a flight and later flies in from the last shot", () => {
    const { shot } = reelTiming()
    const first = SHOTS[0]
    const last = SHOTS[2]
    expect(frameAt(0).camera.bearing).toBe(first?.from.bearing)
    expect(frameAt(shot * 3).camera.bearing).toBe(last?.to.bearing)
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

describe("typed label", () => {
  it("reserves the full width and types characters in", () => {
    const view = render(<TypedText text="sunset" progress={0} caret />)
    const typed = () => view.container.querySelector(`.${styles.typed}`)
    expect(view.container.querySelector(`.${styles.measure}`)?.textContent).toBe("sunset")
    expect(typed()?.textContent).toBe("")
    view.rerender(<TypedText text="sunset" progress={0.5} caret />)
    expect(typed()?.textContent).toBe("sun")
    view.rerender(<TypedText text="sunset" progress={1} caret />)
    expect(typed()?.textContent).toBe("sunset")
    expect(typed()?.querySelector("span")?.style.opacity).toBe("0")
  })
})

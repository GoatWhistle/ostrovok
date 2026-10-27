import { render } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { storyFrame } from "@/features/scene-reel/playback/story-frame"
import { coverTiming } from "@/features/scene-reel/playback/timing"
import { TypedRequest } from "@/features/scene-reel/story/typed-request"
import styles from "@/features/scene-reel/story/typed-request.module.css"
import { motionCurve } from "@/shared/motion"
import { applyMotionTokens } from "../../setup/motionEnvironment"

beforeEach(applyMotionTokens)
const frameAt = (time: number, width = 720) =>
  storyFrame(time, coverTiming(), width, 900, motionCurve("--ease-out"), motionCurve("--ease-fold"))

describe("approved cover timing", () => {
  it("finishes the 1200 ms route before showing its complete result at 7400 ms", () => {
    expect(frameAt(5500).route).toBe(0)
    expect(frameAt(6100).route).toBe(0.5)
    expect(frameAt(6700).route).toBe(1)
    expect(frameAt(6700).proof).toBe(0)
    expect(frameAt(7400).proof).toBe(1)
    expect(frameAt(8399).proof).toBe(1)
  })
  it("starts the window after exactly one second of the finished route result", () => {
    expect(coverTiming().windowAt).toBe(8400)
    expect(frameAt(8399).second).toBe(false)
    expect(frameAt(8400).second).toBe(true)
    expect(frameAt(8800).wish).toBe(1)
    expect(frameAt(8800).proof).toBe(0)
    expect(frameAt(8800).routeOpacity).toBe(0)
  })
  it("dissolves the map, opens the shutters and holds the final eight-second story", () => {
    expect(frameAt(11100).world).toBe(0)
    expect(frameAt(11900).world).toBe(1)
    expect(frameAt(11700).open).toBe(0)
    expect(frameAt(13500).open).toBe(1)
    expect(frameAt(14300).finish).toBe(1)
    expect(coverTiming().total).toBe(16400)
    expect(frameAt(16400)).toMatchObject({ world: 1, open: 1, finish: 1, drift: 1 })
    expect(frameAt(100000)).toMatchObject({ world: 1, open: 1, finish: 1, drift: 1 })
  })
  it("adapts the first approach without changing the final hotel location", () => {
    expect(frameAt(7400, 375).camera.zoom).toBeLessThan(frameAt(7400, 720).camera.zoom)
    expect(frameAt(7400, 720).camera.zoom).toBe(17.1)
    expect(frameAt(16400, 375).camera.center).toEqual(frameAt(16400, 720).camera.center)
  })
})

describe("request typing", () => {
  it.each([
    [1800, 2000],
    [1000, 1200],
  ])("types in %i ms after a 200 ms delay", (duration, end) => {
    const props = { text: "A complete wish", label: "Example", duration, timing: coverTiming() }
    const view = render(<TypedRequest {...props} time={199} />)
    const typed = () => view.container.querySelector(`.${styles.typed}`)
    expect(typed()?.textContent).toBe("")
    const measure = view.container.querySelector(`.${styles.measure}`)
    expect(measure?.textContent).toBe(props.text)
    view.rerender(<TypedRequest {...props} time={200 + duration / 2} />)
    expect(typed()?.textContent).toBe(props.text.slice(0, Math.floor(props.text.length / 2)))
    view.rerender(<TypedRequest {...props} time={end} />)
    expect(typed()?.textContent).toBe(props.text)
    expect(typed()?.querySelector("span")?.style.opacity).toBe("0")
    expect(view.container.querySelector(".visually-hidden")?.textContent).toBe(props.text)
    expect(view.container.querySelector("[aria-live]")).toBeNull()
    expect(view.container.querySelector(`.${styles.measure}`)).toBe(measure)
  })
})

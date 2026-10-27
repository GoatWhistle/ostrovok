import type { CoverTiming } from "./timing"

export const span = (time: number, start: number, end: number) =>
  Math.max(0, Math.min(1, (time - start) / Math.max(1, end - start)))
const mix = (from: number, to: number, amount: number) => from + (to - from) * amount

export function storyFrame(
  time: number,
  timing: CoverTiming,
  width: number,
  height: number,
  ease: (value: number) => number,
  fold: (value: number) => number,
) {
  const second = time >= timing.windowAt
  const local = Math.max(0, time - timing.windowAt)
  const travel = fold(span(time, timing.flightAt, timing.arrivalAt))
  const approach = fold(span(local, timing.swap, timing.windowArrival))
  const swap = second ? ease(span(local, 0, timing.swap)) : 0
  const compact = width < 500
  const zoom = compact
    ? Math.min(16.65, 16.65 + Math.log2(Math.max(100, height - 236) / 300))
    : 17.1
  const padding = compact ? Math.min(210, height * 0.5) : Math.min(160, height * 0.28)
  const routeEnd = timing.routeAt + timing.route
  return {
    second,
    local,
    route: span(time, timing.routeAt, routeEnd),
    routeOpacity: 1 - swap,
    selected:
      ease(span(time, timing.selectionAt, timing.selectionAt + timing.selection)) * (1 - swap),
    goal: ease(span(time, timing.goalAt, timing.routeAt)) * (1 - swap),
    request:
      span(time, 0, timing.requestIn) *
      (1 - span(time, timing.requestOutAt, timing.requestOutAt + timing.requestOut)) *
      (1 - swap),
    proof: ease(span(time, routeEnd, routeEnd + timing.proof)) * (1 - swap),
    wish:
      swap *
      (1 - ease(span(local, timing.windowRequestOut, timing.windowRequestOut + timing.requestIn))),
    world: second ? ease(span(local, timing.dissolveAt, timing.dissolveAt + timing.dissolve)) : 0,
    open: fold(span(local, timing.openAt, timing.openAt + timing.open)),
    finish: ease(span(local, timing.finishAt, timing.finishAt + timing.finish)),
    drift: span(local, timing.dissolveAt + timing.dissolve, timing.driftEnd),
    camera: second
      ? {
          center: [mix(39.903221, 39.904065, approach), mix(43.44578, 43.4451502, approach)] as [
            number,
            number,
          ],
          zoom: mix(zoom, 18.35, approach),
          pitch: mix(50, 73, approach),
          bearing: mix(-24, -52, approach),
          padding: { top: 0, right: 0, bottom: mix(padding, 0, approach), left: 0 },
        }
      : {
          center: [mix(39.907, 39.903221, travel), mix(43.4482, 43.44578, travel)] as [
            number,
            number,
          ],
          zoom: mix(14.5, zoom, travel),
          pitch: mix(16, 50, travel),
          bearing: mix(-54, -24, travel),
          padding: { top: 0, right: 0, bottom: padding, left: 0 },
        },
  }
}

export type StoryFrame = ReturnType<typeof storyFrame>

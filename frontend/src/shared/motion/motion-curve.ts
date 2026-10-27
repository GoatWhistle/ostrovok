import { type EasingToken, readEasing } from "./css-tokens"

export function motionCurve(token: EasingToken) {
  const values = readEasing(token)
    .match(/-?\d*\.?\d+/g)
    ?.map(Number)
  if (values?.length !== 4) return (value: number) => value
  const [x1 = 0, y1 = 0, x2 = 1, y2 = 1] = values
  const coordinate = (t: number, a: number, b: number) =>
    3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t * t * b + t ** 3
  return (value: number) => {
    if (value <= 0 || value >= 1) return Math.max(0, Math.min(1, value))
    let low = 0
    let high = 1
    let at = value
    for (let index = 0; index < 16; index += 1) {
      at = (low + high) / 2
      if (coordinate(at, x1, x2) < value) low = at
      else high = at
    }
    return coordinate(at, y1, y2)
  }
}

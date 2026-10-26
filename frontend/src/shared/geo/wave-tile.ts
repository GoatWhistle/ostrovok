export const WAVE_TILE = 256

const STROKES = 140
const MIN_LENGTH = 4
const LENGTH_RANGE = 16
const MIN_ALPHA = 0.15
const ALPHA_RANGE = 0.6
const MIN_WIDTH = 0.6
const WIDTH_RANGE = 1.1
const BEND = 0.35

function seeded(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

function stroke(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  length: number,
  bend: number,
) {
  for (const dx of [-WAVE_TILE, 0, WAVE_TILE])
    for (const dy of [-WAVE_TILE, 0, WAVE_TILE]) {
      context.beginPath()
      context.moveTo(x + dx - length / 2, y + dy)
      context.quadraticCurveTo(x + dx, y + dy - bend, x + dx + length / 2, y + dy)
      context.stroke()
    }
}

export function createWaveTile(color: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = WAVE_TILE
  canvas.height = WAVE_TILE
  const context = canvas.getContext("2d")
  if (!context) return canvas
  const random = seeded(7)
  context.strokeStyle = color
  context.lineCap = "round"
  for (let index = 0; index < STROKES; index += 1) {
    const length = MIN_LENGTH + random() * LENGTH_RANGE
    context.globalAlpha = MIN_ALPHA + random() * ALPHA_RANGE
    context.lineWidth = MIN_WIDTH + random() * WIDTH_RANGE
    stroke(
      context,
      random() * WAVE_TILE,
      random() * WAVE_TILE,
      length,
      length * BEND * (random() - 0.3),
    )
  }
  return canvas
}

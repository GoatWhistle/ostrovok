import { type FlatBox, writeHousings, writeParapet } from "./flat"
import { type Local, type LocalFrame, localFrame } from "./frame"
import { planRoof } from "./plan"
import { writeRoof } from "./shapes"
import { RoofWriter } from "./writer"

type LonLat = readonly [number, number]

export interface RoofInput {
  readonly id: string
  readonly ring: readonly LonLat[]
  readonly extra: readonly LonLat[]
  readonly height: number
  readonly levels: number | null
  readonly ground: number
}

export interface RoofMesh {
  readonly origin: LonLat
  readonly vertices: Float32Array
  readonly indices: Uint32Array
}

const EARTH_CIRCUMFERENCE_M = 2 * Math.PI * 6371008.8
const MAX_PITCHED_HEIGHT = 16
const MAX_PITCHED_LEVELS = 5
const MIN_PITCHED_AREA = 25
const MAX_PITCHED_AREA = 900
const MIN_RECTANGULARITY = 0.78
const MIN_FLAT_AREA = 60

function mercator(lon: number, lat: number): Local {
  const sin = Math.sin((lat * Math.PI) / 180)
  return [(lon + 180) / 360, 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)]
}

function projector(origin: LonLat) {
  const [ox, oy] = mercator(origin[0], origin[1])
  const metres = EARTH_CIRCUMFERENCE_M * Math.cos((origin[1] * Math.PI) / 180)
  return (points: readonly LonLat[]): Local[] =>
    points.map(([lon, lat]) => {
      const [x, y] = mercator(lon, lat)
      return [(x - ox) * metres, (y - oy) * metres] as const
    })
}

export function isPitched(
  input: { readonly height: number; readonly levels: number | null },
  frame: LocalFrame,
): boolean {
  return (
    input.height <= MAX_PITCHED_HEIGHT &&
    (input.levels ?? 0) <= MAX_PITCHED_LEVELS &&
    frame.area >= MIN_PITCHED_AREA &&
    frame.area <= MAX_PITCHED_AREA &&
    frame.rectangularity >= MIN_RECTANGULARITY
  )
}

function writeFlat(writer: RoofWriter, input: RoofInput, ring: Local[], frame: LocalFrame) {
  const base = input.ground + input.height
  writer.begin({ center: [0, 0], major: [1, 0], minor: [0, 1], base }, 0)
  writeParapet(writer, ring)
  writer.begin({ center: frame.center, major: frame.major, minor: frame.minor, base }, 0)
  const flat: FlatBox = {
    id: input.id,
    ring,
    halfLength: frame.length / 2,
    halfWidth: frame.width / 2,
    area: frame.area,
    toLocal: (u, v) => [
      frame.center[0] + u * frame.major[0] + v * frame.minor[0],
      frame.center[1] + u * frame.major[1] + v * frame.minor[1],
    ],
  }
  writeHousings(writer, flat)
}

export function buildRoofMesh(inputs: readonly RoofInput[], origin: LonLat): RoofMesh {
  const project = projector(origin)
  const writer = new RoofWriter()
  for (const input of inputs) {
    if (input.height <= 0) continue
    const ring = project(input.ring)
    const frame = localFrame(ring, project(input.extra))
    if (!frame) continue
    if (isPitched(input, frame)) {
      const plan = planRoof({
        id: input.id,
        length: frame.length,
        width: frame.width,
        area: frame.area,
      })
      writer.begin(
        {
          center: frame.center,
          major: frame.major,
          minor: frame.minor,
          base: input.ground + input.height,
        },
        plan.rise,
      )
      writeRoof(writer, { halfLength: frame.length / 2, halfWidth: frame.width / 2 }, plan)
    } else if (frame.area >= MIN_FLAT_AREA) writeFlat(writer, input, ring, frame)
  }
  return {
    origin,
    vertices: new Float32Array(writer.vertices),
    indices: new Uint32Array(writer.indices),
  }
}

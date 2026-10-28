import {
  type CustomLayerInterface,
  type CustomRenderMethodInput,
  type Map as MapLibreMap,
  MercatorCoordinate,
} from "maplibre-gl"
import { linkProgram } from "@/shared/geo/textured-building/material"
import { HOTEL, SUNSET_AZIMUTH } from "../shots"
import { GLITTER_FRAGMENT, GLITTER_VERTEX, SUN_FRAGMENT, SUN_VERTEX } from "./sunset-shaders"

export const SUNSET_LAYER = "reel-sunset"
const GLITTER_FROM = 190
const GLITTER_TO = 560
const GLITTER_HALF = 70
const SUN_METERS = 560
const SUN_PX = 200
const QUAD = new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1])

type Rgb = readonly [number, number, number]

export interface SunsetColors {
  readonly warm: Rgb
  readonly hot: Rgb
  readonly core: Rgb
}

interface Program {
  readonly program: WebGLProgram
  readonly array: WebGLVertexArrayObject
  readonly buffer: WebGLBuffer
  readonly at: (name: string) => WebGLUniformLocation | null
}

function axis(): [number, number] {
  const radians = (SUNSET_AZIMUTH * Math.PI) / 180
  return [Math.sin(radians), -Math.cos(radians)]
}

function glitterQuad(): Float32Array {
  const [ax, ay] = axis()
  const [sx, sy] = [-ay, ax]
  const corner = (along: number, across: number) => [
    ax * along + sx * across,
    ay * along + sy * across,
  ]
  const a = corner(GLITTER_FROM, -GLITTER_HALF * 0.4)
  const b = corner(GLITTER_FROM, GLITTER_HALF * 0.4)
  const c = corner(GLITTER_TO, GLITTER_HALF)
  const d = corner(GLITTER_TO, -GLITTER_HALF)
  return new Float32Array([a, b, c, a, c, d].flat())
}

function build(gl: WebGL2RenderingContext, vertex: string, fragment: string, data: Float32Array) {
  const program = linkProgram(gl, vertex, fragment)
  const array = gl.createVertexArray()
  const buffer = gl.createBuffer()
  if (!array || !buffer) throw new Error("Sunset GPU resources unavailable")
  gl.bindVertexArray(array)
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
  const location = gl.getAttribLocation(program, gl.getActiveAttrib(program, 0)?.name ?? "")
  gl.enableVertexAttribArray(location)
  gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0)
  gl.bindVertexArray(null)
  const cache = new Map<string, WebGLUniformLocation | null>()
  const at = (name: string) => {
    if (!cache.has(name)) cache.set(name, gl.getUniformLocation(program, name))
    return cache.get(name) ?? null
  }
  return { program, array, buffer, at }
}

export class SunsetLayer implements CustomLayerInterface {
  readonly id = SUNSET_LAYER
  readonly type = "custom"
  readonly renderingMode = "3d"
  private map: MapLibreMap | undefined
  private glitter: Program | undefined
  private sun: Program | undefined
  private readonly matrix = new Float32Array(16)
  private intensity = 0
  private colors: SunsetColors = {
    warm: [1, 0.5, 0.3],
    hot: [1, 0.75, 0.45],
    core: [1, 0.95, 0.85],
  }

  onAdd(map: MapLibreMap, gl: WebGL2RenderingContext) {
    this.map = map
    this.glitter = build(gl, GLITTER_VERTEX, GLITTER_FRAGMENT, glitterQuad())
    this.sun = build(gl, SUN_VERTEX, SUN_FRAGMENT, QUAD)
  }

  update(intensity: number, colors: SunsetColors) {
    this.intensity = intensity
    this.colors = colors
  }

  private localMatrix(main: ArrayLike<number>) {
    const origin = MercatorCoordinate.fromLngLat([HOTEL[0], HOTEL[1]], 0)
    const scale = origin.meterInMercatorCoordinateUnits()
    for (let row = 0; row < 4; row += 1) {
      const c0 = main[row] ?? 0
      const c1 = main[4 + row] ?? 0
      this.matrix[row] = c0 * scale
      this.matrix[4 + row] = c1 * scale
      this.matrix[8 + row] = (main[8 + row] ?? 0) * scale
      this.matrix[12 + row] = c0 * origin.x + c1 * origin.y + (main[12 + row] ?? 0)
    }
  }

  private paint(gl: WebGL2RenderingContext, target: Program) {
    // biome-ignore lint/correctness/useHookAtTopLevel: WebGL useProgram is not a React hook
    gl.useProgram(target.program)
    gl.uniformMatrix4fv(target.at("u_matrix"), false, this.matrix)
    gl.uniform3f(target.at("u_warm"), ...this.colors.warm)
    gl.uniform3f(target.at("u_hot"), ...this.colors.hot)
    gl.uniform3f(target.at("u_core"), ...this.colors.core)
    gl.uniform1f(target.at("u_intensity"), this.intensity)
    gl.bindVertexArray(target.array)
  }

  render(gl: WebGL2RenderingContext, input: CustomRenderMethodInput) {
    const { glitter, sun, map } = this
    if (!glitter || !sun || !map || this.intensity <= 0.001) return
    this.localMatrix(input.defaultProjectionData.mainMatrix)
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
    gl.depthMask(false)
    gl.enable(gl.BLEND)
    gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE)
    const [ax, ay] = axis()
    this.paint(gl, glitter)
    gl.uniform2f(glitter.at("u_axis"), ax, ay)
    gl.uniform2f(glitter.at("u_reach"), GLITTER_FROM, GLITTER_TO)
    gl.uniform1f(glitter.at("u_time"), performance.now() / 1000)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    this.paint(gl, sun)
    gl.uniform3f(sun.at("u_anchor"), ax * SUN_METERS, ay * SUN_METERS, 0)
    const canvas = map.getCanvas()
    gl.uniform2f(sun.at("u_size"), SUN_PX / canvas.clientWidth, SUN_PX / canvas.clientHeight)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    gl.bindVertexArray(null)
    gl.disable(gl.BLEND)
    gl.depthMask(true)
  }

  onRemove(_map: MapLibreMap, gl: WebGL2RenderingContext) {
    for (const target of [this.glitter, this.sun]) {
      if (!target) continue
      gl.deleteProgram(target.program)
      gl.deleteVertexArray(target.array)
      gl.deleteBuffer(target.buffer)
    }
    this.glitter = undefined
    this.sun = undefined
    this.map = undefined
  }
}

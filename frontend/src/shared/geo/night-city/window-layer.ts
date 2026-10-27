import {
  type CustomLayerInterface,
  type CustomRenderMethodInput,
  type Map as MapLibreMap,
  MercatorCoordinate,
} from "maplibre-gl"
import { linkProgram } from "../textured-building/material"
import { WINDOW_STRIDE, type WindowMesh } from "./window-mesh"
import { WINDOW_FRAGMENT, WINDOW_VERTEX } from "./window-shaders"

export const WINDOW_LAYER = "night-windows"
const ATTRIBUTES = [
  ["a_position", 3, 0],
  ["a_wall", 2, 12],
  ["a_seed", 1, 20],
] as const

export interface WindowLight {
  readonly night: number
  readonly fade: number
  readonly density: number
  readonly glass: number
  readonly warm: readonly [number, number, number]
  readonly cool: readonly [number, number, number]
}

export class WindowLayer implements CustomLayerInterface {
  readonly id = WINDOW_LAYER
  readonly type = "custom"
  readonly renderingMode = "3d"
  private map: MapLibreMap | undefined
  private gl: WebGL2RenderingContext | undefined
  private program: WebGLProgram | undefined
  private vao: WebGLVertexArrayObject | null = null
  private vertices: WebGLBuffer | null = null
  private indices: WebGLBuffer | null = null
  private uniforms: Record<string, WebGLUniformLocation | null> = {}
  private count = 0
  private origin: readonly [number, number] = [0, 0]
  private pending: WindowMesh | undefined
  private light: WindowLight = {
    night: 0,
    fade: 0,
    density: 1,
    glass: 0,
    warm: [1, 0.8, 0.5],
    cool: [0.36, 0.9, 1],
  }

  onAdd(map: MapLibreMap, gl: WebGL2RenderingContext) {
    this.map = map
    this.gl = gl
    this.program = linkProgram(gl, WINDOW_VERTEX, WINDOW_FRAGMENT)
    this.vao = gl.createVertexArray()
    this.vertices = gl.createBuffer()
    this.indices = gl.createBuffer()
    if (!this.vao || !this.vertices || !this.indices)
      throw new Error("Window GPU resources unavailable")
    gl.bindVertexArray(this.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertices)
    for (const [name, size, offset] of ATTRIBUTES) {
      const location = gl.getAttribLocation(this.program, name)
      gl.enableVertexAttribArray(location)
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, WINDOW_STRIDE * 4, offset)
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indices)
    gl.bindVertexArray(null)
    for (const name of [
      "u_matrix",
      "u_night",
      "u_fade",
      "u_density",
      "u_glass",
      "u_warm",
      "u_cool",
    ])
      this.uniforms[name] = gl.getUniformLocation(this.program, name)
    if (this.pending) this.setMesh(this.pending)
  }

  setMesh(mesh: WindowMesh) {
    this.pending = mesh
    const gl = this.gl
    if (!gl || !this.vao) return
    gl.bindVertexArray(this.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertices)
    gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indices)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW)
    gl.bindVertexArray(null)
    this.count = mesh.indices.length
    this.origin = mesh.origin
    this.map?.triggerRepaint()
  }

  setLight(light: WindowLight) {
    const changed =
      Math.abs(light.night - this.light.night) > 0.01 ||
      Math.abs(light.fade - this.light.fade) > 0.01 ||
      light.density !== this.light.density ||
      light.glass !== this.light.glass
    this.light = light
    if (changed) this.map?.triggerRepaint()
  }

  render(gl: WebGL2RenderingContext, input: CustomRenderMethodInput) {
    if (!this.program || this.count === 0 || this.light.fade <= 0 || this.light.density <= 0) return
    const origin = MercatorCoordinate.fromLngLat([...this.origin], 0)
    const scale = origin.meterInMercatorCoordinateUnits()
    const matrix = new DOMMatrix(Array.from(input.defaultProjectionData.mainMatrix))
      .translate(origin.x, origin.y, 0)
      .scale(scale, scale, scale)
    // biome-ignore lint/correctness/useHookAtTopLevel: WebGL useProgram is not a React hook
    gl.useProgram(this.program)
    gl.bindVertexArray(this.vao)
    gl.uniformMatrix4fv(this.uniforms.u_matrix ?? null, false, matrix.toFloat32Array())
    gl.uniform1f(this.uniforms.u_night ?? null, this.light.night)
    gl.uniform1f(this.uniforms.u_fade ?? null, this.light.fade)
    gl.uniform1f(this.uniforms.u_density ?? null, this.light.density)
    gl.uniform1f(this.uniforms.u_glass ?? null, this.light.glass)
    gl.uniform3f(this.uniforms.u_warm ?? null, ...this.light.warm)
    gl.uniform3f(this.uniforms.u_cool ?? null, ...this.light.cool)
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
    gl.depthMask(false)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.disable(gl.CULL_FACE)
    gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_INT, 0)
    gl.bindVertexArray(null)
    gl.depthMask(true)
  }

  onRemove() {
    const gl = this.gl
    if (gl) {
      gl.deleteBuffer(this.vertices)
      gl.deleteBuffer(this.indices)
      gl.deleteVertexArray(this.vao)
      if (this.program) gl.deleteProgram(this.program)
    }
    this.program = undefined
    this.map = undefined
    this.gl = undefined
    this.count = 0
  }
}

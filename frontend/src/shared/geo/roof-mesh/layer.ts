import {
  type CustomLayerInterface,
  type CustomRenderMethodInput,
  type Map as MapLibreMap,
  MercatorCoordinate,
} from "maplibre-gl"
import { linkProgram } from "../textured-building/material"
import { roofFog } from "./fog"
import type { RoofMesh } from "./mesh"
import { ROOF_FRAGMENT, ROOF_VERTEX } from "./shaders"
import { ROOF_STRIDE } from "./writer"

export const ROOF_MESH_LAYER = "roof-mesh"
const ATTRIBUTES = [
  ["a_position", 3, 0],
  ["a_normal", 3, 12],
  ["a_tone", 1, 24],
  ["a_base", 1, 28],
] as const
const UNIFORMS = [
  "u_matrix",
  "u_grow",
  "u_sun",
  "u_light",
  "u_ambient",
  "u_palette",
  "u_fog_depth",
  "u_fog_color",
  "u_horizon_color",
  "u_fog_blend",
] as const
const layers = new WeakMap<MapLibreMap, RoofMeshLayer>()

export interface RoofLight {
  readonly palette: readonly (readonly [number, number, number])[]
  readonly sun: readonly [number, number, number]
  readonly light: readonly [number, number, number]
  readonly ambient: readonly [number, number, number]
}

export class RoofMeshLayer implements CustomLayerInterface {
  readonly id = ROOF_MESH_LAYER
  readonly type = "custom"
  readonly renderingMode = "3d"
  private map: MapLibreMap | undefined
  private gl: WebGL2RenderingContext | undefined
  private program: WebGLProgram | undefined
  private vao: WebGLVertexArrayObject | null = null
  private vertices: WebGLBuffer | null = null
  private indices: WebGLBuffer | null = null
  private uniforms: Partial<Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>> = {}
  private count = 0
  private origin: readonly [number, number] = [0, 0]
  private pending: RoofMesh | undefined
  private grow = 0
  private lighting: RoofLight | undefined

  onAdd(map: MapLibreMap, gl: WebGL2RenderingContext) {
    this.map = map
    this.gl = gl
    layers.set(map, this)
    this.program = linkProgram(gl, ROOF_VERTEX, ROOF_FRAGMENT)
    this.vao = gl.createVertexArray()
    this.vertices = gl.createBuffer()
    this.indices = gl.createBuffer()
    if (!this.vao || !this.vertices || !this.indices)
      throw new Error("Roof GPU resources unavailable")
    gl.bindVertexArray(this.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertices)
    for (const [name, size, offset] of ATTRIBUTES) {
      const location = gl.getAttribLocation(this.program, name)
      gl.enableVertexAttribArray(location)
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, ROOF_STRIDE * 4, offset)
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indices)
    gl.bindVertexArray(null)
    for (const name of UNIFORMS) this.uniforms[name] = gl.getUniformLocation(this.program, name)
    if (this.pending) this.setMesh(this.pending)
  }

  setMesh(mesh: RoofMesh) {
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

  setGrow(grow: number) {
    if (Math.abs(grow - this.grow) < 0.01) return
    this.grow = grow
    this.map?.triggerRepaint()
  }

  setLight(lighting: RoofLight | undefined) {
    this.lighting = lighting
    this.map?.triggerRepaint()
  }

  render(gl: WebGL2RenderingContext, input: CustomRenderMethodInput) {
    const lighting = this.lighting
    if (!this.program || !lighting || this.count === 0 || this.grow <= 0) return
    const origin = MercatorCoordinate.fromLngLat([...this.origin], 0)
    const scale = origin.meterInMercatorCoordinateUnits()
    const matrix = new DOMMatrix(Array.from(input.defaultProjectionData.mainMatrix))
      .translate(origin.x, origin.y, 0)
      .scale(scale, scale, scale)
    // biome-ignore lint/correctness/useHookAtTopLevel: WebGL useProgram is not a React hook
    gl.useProgram(this.program)
    gl.bindVertexArray(this.vao)
    gl.uniformMatrix4fv(this.uniforms.u_matrix ?? null, false, matrix.toFloat32Array())
    gl.uniform1f(this.uniforms.u_grow ?? null, this.grow)
    gl.uniform3f(this.uniforms.u_sun ?? null, ...lighting.sun)
    gl.uniform3f(this.uniforms.u_light ?? null, ...lighting.light)
    gl.uniform3f(this.uniforms.u_ambient ?? null, ...lighting.ambient)
    gl.uniform3fv(this.uniforms.u_palette ?? null, lighting.palette.flat())
    if (this.map) this.fog(gl, this.map, input.defaultProjectionData.mainMatrix)
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
    gl.depthMask(true)
    gl.disable(gl.BLEND)
    gl.disable(gl.CULL_FACE)
    gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_INT, 0)
    gl.bindVertexArray(null)
  }

  private fog(gl: WebGL2RenderingContext, map: MapLibreMap, matrix: ArrayLike<number>) {
    const fog = roofFog(map, matrix)
    gl.uniform2f(this.uniforms.u_fog_depth ?? null, ...fog.depth)
    gl.uniform3f(this.uniforms.u_fog_color ?? null, ...fog.color)
    gl.uniform3f(this.uniforms.u_horizon_color ?? null, ...fog.horizon)
    gl.uniform3f(this.uniforms.u_fog_blend ?? null, ...fog.blend)
  }

  onRemove() {
    const gl = this.gl
    if (gl) {
      gl.deleteBuffer(this.vertices)
      gl.deleteBuffer(this.indices)
      gl.deleteVertexArray(this.vao)
      if (this.program) gl.deleteProgram(this.program)
    }
    if (this.map) layers.delete(this.map)
    this.program = undefined
    this.map = undefined
    this.gl = undefined
    this.count = 0
  }
}

export function roofMeshOf(map: MapLibreMap): RoofMeshLayer | undefined {
  return layers.get(map)
}

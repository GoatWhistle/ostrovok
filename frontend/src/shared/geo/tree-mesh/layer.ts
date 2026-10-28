import {
  type CustomLayerInterface,
  type CustomRenderMethodInput,
  type Map as MapLibreMap,
  MercatorCoordinate,
} from "maplibre-gl"
import { linkProgram } from "../textured-building/material"
import { broadleaf, bush, conifer, SHADOW_QUAD, TREE_STRIDE } from "./geometry"
import { SHADOW_FRAGMENT, SHADOW_VERTEX, TREE_FRAGMENT, TREE_VERTEX } from "./shaders"
import { type TreeLight, treeUniforms } from "./uniforms"

export const TREE_LAYER = "tree-mesh"
export const INSTANCE_STRIDE = 6
const KINDS = [broadleaf, conifer, bush] as const
const layers = new WeakMap<MapLibreMap, TreeLayer>()

export interface TreeInstances {
  readonly origin: readonly [number, number]
  readonly kinds: readonly Float32Array[]
}

interface Kind {
  readonly mesh: WebGLBuffer
  readonly vertices: number
  readonly tree: WebGLVertexArrayObject
  readonly shadow: WebGLVertexArrayObject
  readonly instances: WebGLBuffer
  count: number
}

interface Attribute {
  readonly name: string
  readonly size: number
  readonly stride: number
  readonly offset: number
  readonly divisor?: number
}

function bind(gl: WebGL2RenderingContext, program: WebGLProgram, attribute: Attribute) {
  const location = gl.getAttribLocation(program, attribute.name)
  if (location < 0) return
  gl.enableVertexAttribArray(location)
  gl.vertexAttribPointer(
    location,
    attribute.size,
    gl.FLOAT,
    false,
    attribute.stride * 4,
    attribute.offset * 4,
  )
  gl.vertexAttribDivisor(location, attribute.divisor ?? 0)
}

function instanced(name: string, size: number, offset: number): Attribute {
  return { name, size, stride: INSTANCE_STRIDE, offset, divisor: 1 }
}

export class TreeLayer implements CustomLayerInterface {
  readonly id = TREE_LAYER
  readonly type = "custom"
  readonly renderingMode = "3d"
  private map: MapLibreMap | undefined
  private gl: WebGL2RenderingContext | undefined
  private trees: WebGLProgram | undefined
  private shadows: WebGLProgram | undefined
  private quad: WebGLBuffer | null = null
  private kinds: Kind[] = []
  private origin: readonly [number, number] = [0, 0]
  private pending: TreeInstances | undefined
  private grow = 0
  private lighting: TreeLight | undefined

  onAdd(map: MapLibreMap, gl: WebGL2RenderingContext) {
    this.map = map
    this.gl = gl
    layers.set(map, this)
    this.trees = linkProgram(gl, TREE_VERTEX, TREE_FRAGMENT)
    this.shadows = linkProgram(gl, SHADOW_VERTEX, SHADOW_FRAGMENT)
    this.quad = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad)
    gl.bufferData(gl.ARRAY_BUFFER, SHADOW_QUAD, gl.STATIC_DRAW)
    this.kinds = KINDS.map((make) => this.createKind(gl, make()))
    gl.bindVertexArray(null)
    if (this.pending) this.setTrees(this.pending)
  }

  private createKind(gl: WebGL2RenderingContext, geometry: Float32Array): Kind {
    const trees = this.trees
    const shadows = this.shadows
    const mesh = gl.createBuffer()
    const instances = gl.createBuffer()
    const tree = gl.createVertexArray()
    const shadow = gl.createVertexArray()
    if (!trees || !shadows || !mesh || !instances || !tree || !shadow)
      throw new Error("Tree GPU resources unavailable")
    gl.bindVertexArray(tree)
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh)
    gl.bufferData(gl.ARRAY_BUFFER, geometry, gl.STATIC_DRAW)
    bind(gl, trees, { name: "a_position", size: 3, stride: TREE_STRIDE, offset: 0 })
    bind(gl, trees, { name: "a_normal", size: 3, stride: TREE_STRIDE, offset: 3 })
    bind(gl, trees, { name: "a_part", size: 1, stride: TREE_STRIDE, offset: 6 })
    gl.bindBuffer(gl.ARRAY_BUFFER, instances)
    bind(gl, trees, instanced("a_offset", 3, 0))
    bind(gl, trees, instanced("a_size", 1, 3))
    bind(gl, trees, instanced("a_tone", 1, 4))
    bind(gl, trees, instanced("a_spin", 1, 5))
    gl.bindVertexArray(shadow)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad)
    bind(gl, shadows, { name: "a_corner", size: 2, stride: 2, offset: 0 })
    gl.bindBuffer(gl.ARRAY_BUFFER, instances)
    bind(gl, shadows, instanced("a_offset", 3, 0))
    bind(gl, shadows, instanced("a_size", 1, 3))
    return { mesh, vertices: geometry.length / TREE_STRIDE, tree, shadow, instances, count: 0 }
  }

  setTrees(instances: TreeInstances) {
    this.pending = instances
    const gl = this.gl
    if (!gl) return
    this.kinds.forEach((kind, index) => {
      const data = instances.kinds[index] ?? new Float32Array()
      gl.bindBuffer(gl.ARRAY_BUFFER, kind.instances)
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
      kind.count = data.length / INSTANCE_STRIDE
    })
    this.origin = instances.origin
    this.map?.triggerRepaint()
  }

  setGrow(grow: number) {
    if (Math.abs(grow - this.grow) < 0.01) return
    this.grow = grow
    this.map?.triggerRepaint()
  }

  setLight(lighting: TreeLight | undefined) {
    this.lighting = lighting
    this.map?.triggerRepaint()
  }

  private matrix(input: CustomRenderMethodInput): Float32Array {
    const origin = MercatorCoordinate.fromLngLat([...this.origin], 0)
    const scale = origin.meterInMercatorCoordinateUnits()
    return new DOMMatrix(Array.from(input.defaultProjectionData.mainMatrix))
      .translate(origin.x, origin.y, 0)
      .scale(scale, scale, scale)
      .toFloat32Array()
  }

  render(gl: WebGL2RenderingContext, input: CustomRenderMethodInput) {
    const lighting = this.lighting
    const trees = this.trees
    const shadows = this.shadows
    if (!trees || !shadows || !lighting || this.grow <= 0) return
    const matrix = this.matrix(input)
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
    gl.disable(gl.CULL_FACE)
    if (lighting.shadowAlpha > 0) {
      treeUniforms(gl, shadows, matrix, this.grow, lighting)
      gl.depthMask(false)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
      for (const kind of this.kinds) {
        if (kind.count === 0) continue
        gl.bindVertexArray(kind.shadow)
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, kind.count)
      }
    }
    treeUniforms(gl, trees, matrix, this.grow, lighting)
    gl.depthMask(true)
    gl.disable(gl.BLEND)
    const conifer = gl.getUniformLocation(trees, "u_conifer")
    this.kinds.forEach((kind, index) => {
      if (kind.count === 0) return
      gl.uniform1f(conifer, index === 1 ? 1 : 0)
      gl.bindVertexArray(kind.tree)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, kind.vertices, kind.count)
    })
    gl.bindVertexArray(null)
  }

  onRemove() {
    const gl = this.gl
    if (gl) {
      for (const kind of this.kinds) {
        gl.deleteBuffer(kind.instances)
        gl.deleteBuffer(kind.mesh)
        gl.deleteVertexArray(kind.tree)
        gl.deleteVertexArray(kind.shadow)
      }
      gl.deleteBuffer(this.quad)
      if (this.trees) gl.deleteProgram(this.trees)
      if (this.shadows) gl.deleteProgram(this.shadows)
    }
    if (this.map) layers.delete(this.map)
    this.kinds = []
    this.trees = undefined
    this.shadows = undefined
    this.map = undefined
    this.gl = undefined
  }
}

export function treeLayerOf(map: MapLibreMap): TreeLayer | undefined {
  return layers.get(map)
}

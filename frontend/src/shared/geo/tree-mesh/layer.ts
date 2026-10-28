import {
  type CustomLayerInterface,
  type CustomRenderMethodInput,
  type Map as MapLibreMap,
  MercatorCoordinate,
} from "maplibre-gl"
import { linkProgram } from "../textured-building/material"
import { SHADOW_QUAD } from "./geometry"
import { type ChunkedTrees, chunkTrees, INSTANCE_STRIDE, type TreeInstances } from "./instances"
import { createKind, deleteKind, type Kind, uploadInstances } from "./kind"
import { TreeSelection } from "./selection"
import { SHADOW_FRAGMENT, SHADOW_VERTEX, TREE_FRAGMENT, TREE_VERTEX } from "./shaders"
import { type TreeLight, treeUniforms, type Uniforms, uniformsOf } from "./uniforms"
import { cameraOf, focalOf, localMatrix } from "./view"

export { INSTANCE_STRIDE, type TreeInstances }
export const TREE_LAYER = "tree-mesh"
const TREE_METRES = 10
const NEAR_PX = 14
const THIN_PX = 3.2
const layers = new WeakMap<MapLibreMap, TreeLayer>()

interface Programs {
  readonly trees: WebGLProgram
  readonly shadows: WebGLProgram
  readonly treeAt: Uniforms
  readonly shadowAt: Uniforms
}

export class TreeLayer implements CustomLayerInterface {
  readonly id = TREE_LAYER
  readonly type = "custom"
  readonly renderingMode = "3d"
  private map: MapLibreMap | undefined
  private gl: WebGL2RenderingContext | undefined
  private programs: Programs | undefined
  private quad: WebGLBuffer | null = null
  private kinds: Kind[] = []
  private origin = { x: 0, y: 0, scale: 1 }
  private chunked: ChunkedTrees | undefined
  private uploaded = false
  private readonly selection = new TreeSelection()
  private readonly matrix = new Float32Array(16)
  private palette = new Float32Array(18)
  private grow = 0
  private lighting: TreeLight | undefined

  onAdd(map: MapLibreMap, gl: WebGL2RenderingContext) {
    this.map = map
    this.gl = gl
    layers.set(map, this)
    const trees = linkProgram(gl, TREE_VERTEX, TREE_FRAGMENT)
    const shadows = linkProgram(gl, SHADOW_VERTEX, SHADOW_FRAGMENT)
    this.programs = {
      trees,
      shadows,
      treeAt: uniformsOf(gl, trees),
      shadowAt: uniformsOf(gl, shadows),
    }
    this.quad = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad)
    gl.bufferData(gl.ARRAY_BUFFER, SHADOW_QUAD, gl.STATIC_DRAW)
    this.kinds = [0, 1, 2].map((index) => createKind(gl, trees, shadows, this.quad, index))
    gl.bindVertexArray(null)
    if (this.chunked) this.adopt(this.chunked)
  }

  setTrees(instances: TreeInstances) {
    this.setChunks(chunkTrees(instances))
  }

  setChunks(chunked: ChunkedTrees) {
    this.chunked = chunked
    const origin = MercatorCoordinate.fromLngLat([...chunked.origin], 0)
    this.origin = { x: origin.x, y: origin.y, scale: origin.meterInMercatorCoordinateUnits() }
    if (this.gl) this.adopt(chunked)
    this.map?.triggerRepaint()
  }

  private adopt(chunked: ChunkedTrees) {
    const gl = this.gl
    if (!gl) return
    this.selection.reset(chunked)
    chunked.kinds.forEach((data, index) => {
      const kind = this.kinds[index]
      if (!kind) return
      for (const buffer of [kind.near, kind.far]) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
        gl.bufferData(gl.ARRAY_BUFFER, Math.max(4, data.byteLength), gl.DYNAMIC_DRAW)
      }
    })
    this.uploaded = false
  }

  setGrow(grow: number) {
    if (Math.abs(grow - this.grow) < 0.01) return
    this.grow = grow
    this.map?.triggerRepaint()
  }

  setLight(lighting: TreeLight | undefined) {
    this.lighting = lighting
    if (lighting) this.palette = new Float32Array(lighting.palette.flat())
    this.map?.triggerRepaint()
  }

  render(gl: WebGL2RenderingContext, input: CustomRenderMethodInput) {
    const lighting = this.lighting
    const programs = this.programs
    const map = this.map
    const chunked = this.chunked
    if (!programs || !lighting || !map || !chunked || this.grow <= 0) return
    localMatrix(this.matrix, input.defaultProjectionData.mainMatrix, this.origin)
    const camera = cameraOf(this.matrix)
    const reach = TREE_METRES * this.grow * focalOf(map)
    const changed = this.selection.update({
      matrix: this.matrix,
      camera,
      nearDistance: reach / NEAR_PX,
      thinDistance: reach / THIN_PX,
    })
    if (changed || !this.uploaded) uploadInstances(gl, this.kinds, this.selection)
    this.uploaded = true
    const frame = {
      matrix: this.matrix,
      camera,
      grow: this.grow,
      thin: reach / THIN_PX,
      radius: chunked.radius,
    }
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
    gl.disable(gl.CULL_FACE)
    if (lighting.shadowAlpha > 0) this.drawShadows(gl, programs, frame, lighting)
    treeUniforms(gl, programs.trees, programs.treeAt, frame, lighting, this.palette)
    gl.depthMask(true)
    gl.disable(gl.BLEND)
    this.kinds.forEach((kind, index) => {
      gl.uniform1f(programs.treeAt.u_conifer, index === 1 ? 1 : 0)
      const near = this.selection.nearCount[index] ?? 0
      const far = this.selection.farCount[index] ?? 0
      if (near > 0) {
        gl.bindVertexArray(kind.nearTree)
        gl.drawArraysInstanced(gl.TRIANGLES, 0, kind.vertices, near)
      }
      if (far > 0) {
        gl.bindVertexArray(kind.farTree)
        gl.drawArraysInstanced(gl.TRIANGLES, 0, kind.farVertices, far)
      }
    })
    gl.bindVertexArray(null)
  }

  private drawShadows(
    gl: WebGL2RenderingContext,
    programs: Programs,
    frame: Parameters<typeof treeUniforms>[3],
    lighting: TreeLight,
  ) {
    treeUniforms(gl, programs.shadows, programs.shadowAt, frame, lighting, this.palette)
    gl.depthMask(false)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    this.kinds.forEach((kind, index) => {
      const near = this.selection.nearCount[index] ?? 0
      if (near === 0) return
      gl.bindVertexArray(kind.shadow)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, near)
    })
  }

  onRemove() {
    const gl = this.gl
    if (gl) {
      for (const kind of this.kinds) deleteKind(gl, kind)
      gl.deleteBuffer(this.quad)
      if (this.programs) {
        gl.deleteProgram(this.programs.trees)
        gl.deleteProgram(this.programs.shadows)
      }
    }
    if (this.map) layers.delete(this.map)
    this.kinds = []
    this.programs = undefined
    this.map = undefined
    this.gl = undefined
  }
}

export function treeLayerOf(map: MapLibreMap): TreeLayer | undefined {
  return layers.get(map)
}

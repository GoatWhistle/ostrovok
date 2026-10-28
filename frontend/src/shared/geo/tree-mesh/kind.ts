import {
  broadleaf,
  broadleafFar,
  bush,
  bushFar,
  conifer,
  coniferFar,
  TREE_STRIDE,
} from "./geometry"
import { INSTANCE_STRIDE } from "./instances"
import type { TreeSelection } from "./selection"

const MESHES = [
  [broadleaf, broadleafFar],
  [conifer, coniferFar],
  [bush, bushFar],
] as const

export interface Kind {
  readonly meshes: readonly WebGLBuffer[]
  readonly vertices: number
  readonly farVertices: number
  readonly near: WebGLBuffer
  readonly far: WebGLBuffer
  readonly nearTree: WebGLVertexArrayObject
  readonly farTree: WebGLVertexArrayObject
  readonly shadow: WebGLVertexArrayObject
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

function created<T>(value: T | null): T {
  if (!value) throw new Error("Tree GPU resources unavailable")
  return value
}

function treeArray(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  mesh: WebGLBuffer,
  instances: WebGLBuffer,
) {
  const array = created(gl.createVertexArray())
  gl.bindVertexArray(array)
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh)
  bind(gl, program, { name: "a_position", size: 3, stride: TREE_STRIDE, offset: 0 })
  bind(gl, program, { name: "a_normal", size: 3, stride: TREE_STRIDE, offset: 3 })
  bind(gl, program, { name: "a_part", size: 1, stride: TREE_STRIDE, offset: 6 })
  gl.bindBuffer(gl.ARRAY_BUFFER, instances)
  bind(gl, program, instanced("a_offset", 3, 0))
  bind(gl, program, instanced("a_size", 1, 3))
  bind(gl, program, instanced("a_tone", 1, 4))
  bind(gl, program, instanced("a_spin", 1, 5))
  return array
}

function meshBuffer(gl: WebGL2RenderingContext, geometry: Float32Array) {
  const buffer = created(gl.createBuffer())
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, geometry, gl.STATIC_DRAW)
  return buffer
}

export function createKind(
  gl: WebGL2RenderingContext,
  trees: WebGLProgram,
  shadows: WebGLProgram,
  quad: WebGLBuffer | null,
  index: number,
): Kind {
  const [makeNear, makeFar] = MESHES[index] ?? MESHES[0]
  const full = makeNear()
  const low = makeFar()
  const meshes = [meshBuffer(gl, full), meshBuffer(gl, low)]
  const near = created(gl.createBuffer())
  const far = created(gl.createBuffer())
  const nearTree = treeArray(gl, trees, meshes[0] ?? near, near)
  const farTree = treeArray(gl, trees, meshes[1] ?? far, far)
  const shadow = created(gl.createVertexArray())
  gl.bindVertexArray(shadow)
  gl.bindBuffer(gl.ARRAY_BUFFER, quad)
  bind(gl, shadows, { name: "a_corner", size: 2, stride: 2, offset: 0 })
  gl.bindBuffer(gl.ARRAY_BUFFER, near)
  bind(gl, shadows, instanced("a_offset", 3, 0))
  bind(gl, shadows, instanced("a_size", 1, 3))
  bind(gl, shadows, instanced("a_spin", 1, 5))
  return {
    meshes,
    vertices: full.length / TREE_STRIDE,
    farVertices: low.length / TREE_STRIDE,
    near,
    far,
    nearTree,
    farTree,
    shadow,
  }
}

export function uploadInstances(
  gl: WebGL2RenderingContext,
  kinds: readonly Kind[],
  selection: TreeSelection,
) {
  kinds.forEach((kind, index) => {
    const near = selection.nearCount[index] ?? 0
    const far = selection.farCount[index] ?? 0
    const nearData = selection.near[index]
    const farData = selection.far[index]
    if (near > 0 && nearData) {
      gl.bindBuffer(gl.ARRAY_BUFFER, kind.near)
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, nearData, 0, near * INSTANCE_STRIDE)
    }
    if (far > 0 && farData) {
      gl.bindBuffer(gl.ARRAY_BUFFER, kind.far)
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, farData, 0, far * INSTANCE_STRIDE)
    }
  })
}

export function deleteKind(gl: WebGL2RenderingContext, kind: Kind) {
  for (const buffer of [...kind.meshes, kind.near, kind.far]) gl.deleteBuffer(buffer)
  for (const array of [kind.nearTree, kind.farTree, kind.shadow]) gl.deleteVertexArray(array)
}

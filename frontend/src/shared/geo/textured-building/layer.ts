import {
  type CustomLayerInterface,
  type CustomRenderMethodInput,
  type Map as MapLibreMap,
  MercatorCoordinate,
} from "maplibre-gl"
import type { BuildingMaterial } from "../appearance/materials"
import type { SunPosition } from "../terrain"
import type { BuildingMesh } from "./geometry"
import { buildingProgram } from "./material"

export const TEXTURED_HOTEL_LAYER = "selected-hotel-texture"

export class TexturedBuildingLayer implements CustomLayerInterface {
  readonly id = TEXTURED_HOTEL_LAYER
  readonly type = "custom"
  readonly renderingMode = "3d"
  sun: SunPosition = { altitude: 45, azimuth: 180 }
  private map: MapLibreMap | undefined
  private gl: WebGL2RenderingContext | undefined
  private program: WebGLProgram | undefined
  private buffer: WebGLBuffer | null = null
  private vao: WebGLVertexArrayObject | null = null
  private texture: WebGLTexture | null = null
  readonly hotelId: string
  readonly mesh: BuildingMesh
  private readonly image: HTMLImageElement | null
  material: BuildingMaterial

  constructor(
    hotelId: string,
    mesh: BuildingMesh,
    image: HTMLImageElement | null,
    material: BuildingMaterial,
  ) {
    this.hotelId = hotelId
    this.mesh = mesh
    this.image = image
    this.material = material
  }

  onAdd(map: MapLibreMap, gl: WebGL2RenderingContext) {
    this.map = map
    this.gl = gl
    this.program = buildingProgram(gl)
    this.buffer = gl.createBuffer()
    this.vao = gl.createVertexArray()
    this.texture = gl.createTexture()
    if (!this.buffer || !this.vao || !this.texture)
      throw new Error("Building GPU resources unavailable")
    gl.bindVertexArray(this.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.bufferData(gl.ARRAY_BUFFER, this.mesh.vertices, gl.STATIC_DRAW)
    for (const [index, name] of ["a_position", "a_normal", "a_uv"].entries()) {
      const location = gl.getAttribLocation(this.program, name)
      gl.enableVertexAttribArray(location)
      gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 36, index * 12)
    }
    gl.bindVertexArray(null)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    if (this.image) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.image)
    else
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array([255, 255, 255, 255]),
      )
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.bindTexture(gl.TEXTURE_2D, null)
    map.triggerRepaint()
  }

  render(gl: WebGL2RenderingContext, input: CustomRenderMethodInput) {
    if (!this.program || !this.map) return
    const elevation = this.map.queryTerrainElevation([...this.mesh.origin]) ?? this.mesh.ground
    const origin = MercatorCoordinate.fromLngLat([...this.mesh.origin], elevation)
    const scale = origin.meterInMercatorCoordinateUnits()
    const matrix = new DOMMatrix(Array.from(input.defaultProjectionData.mainMatrix))
      .translate(origin.x, origin.y, origin.z)
      .scale(scale, scale, scale)
    const azimuth = (this.sun.azimuth * Math.PI) / 180
    const altitude = (Math.max(0, this.sun.altitude) * Math.PI) / 180
    // biome-ignore lint/correctness/useHookAtTopLevel: WebGL useProgram is not a React hook
    gl.useProgram(this.program)
    gl.bindVertexArray(this.vao)
    gl.uniformMatrix4fv(
      gl.getUniformLocation(this.program, "u_matrix"),
      false,
      matrix.toFloat32Array(),
    )
    gl.uniform3f(
      gl.getUniformLocation(this.program, "u_sun"),
      Math.sin(azimuth) * Math.cos(altitude),
      -Math.cos(azimuth) * Math.cos(altitude),
      Math.sin(altitude),
    )
    gl.uniform1f(
      gl.getUniformLocation(this.program, "u_daylight"),
      this.sun.altitude < -6 ? 0.38 : 1,
    )
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.uniform1i(gl.getUniformLocation(this.program, "u_texture"), 0)
    gl.uniform1f(
      gl.getUniformLocation(this.program, "u_matte"),
      this.material.mode === "matte" ? 1 : 0,
    )
    gl.uniform3f(gl.getUniformLocation(this.program, "u_wall"), ...this.material.wall)
    gl.uniform3f(gl.getUniformLocation(this.program, "u_roof"), ...this.material.roof)
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
    gl.depthMask(true)
    gl.disable(gl.CULL_FACE)
    gl.drawArrays(gl.TRIANGLES, 0, this.mesh.vertices.length / 9)
    gl.bindVertexArray(null)
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  onRemove() {
    if (!this.gl) return
    this.gl.deleteBuffer(this.buffer)
    this.gl.deleteVertexArray(this.vao)
    this.gl.deleteTexture(this.texture)
    if (this.program) this.gl.deleteProgram(this.program)
    this.program = undefined
    this.map = undefined
    this.gl = undefined
  }
}

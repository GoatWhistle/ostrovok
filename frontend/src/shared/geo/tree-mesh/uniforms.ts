type Rgb = readonly [number, number, number]

export interface TreeLight {
  readonly sun: Rgb
  readonly light: Rgb
  readonly ambient: Rgb
  readonly palette: readonly Rgb[]
  readonly shade: Rgb
  readonly shadowAlpha: number
  readonly direction: readonly [number, number]
  readonly length: number
}

export interface TreeFrame {
  readonly matrix: Float32Array
  readonly camera: readonly [number, number, number]
  readonly grow: number
  readonly thin: number
  readonly radius: number
}

const NAMES = [
  "u_matrix",
  "u_grow",
  "u_sun",
  "u_light",
  "u_ambient",
  "u_palette",
  "u_direction",
  "u_length",
  "u_shade",
  "u_alpha",
  "u_conifer",
  "u_camera",
  "u_reach",
] as const

type Name = (typeof NAMES)[number]
export type Uniforms = Readonly<Record<Name, WebGLUniformLocation | null>>

export function uniformsOf(gl: WebGL2RenderingContext, program: WebGLProgram): Uniforms {
  return Object.fromEntries(
    NAMES.map((name) => [name, gl.getUniformLocation(program, name)]),
  ) as Record<Name, WebGLUniformLocation | null>
}

export function treeUniforms(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  at: Uniforms,
  frame: TreeFrame,
  lighting: TreeLight,
  palette: Float32Array,
) {
  // biome-ignore lint/correctness/useHookAtTopLevel: WebGL useProgram is not a React hook
  gl.useProgram(program)
  gl.uniformMatrix4fv(at.u_matrix, false, frame.matrix)
  gl.uniform1f(at.u_grow, frame.grow)
  gl.uniform3f(at.u_camera, ...frame.camera)
  gl.uniform2f(at.u_reach, frame.thin, frame.radius)
  gl.uniform3f(at.u_sun, ...lighting.sun)
  gl.uniform3f(at.u_light, ...lighting.light)
  gl.uniform3f(at.u_ambient, ...lighting.ambient)
  gl.uniform3fv(at.u_palette, palette)
  gl.uniform2f(at.u_direction, ...lighting.direction)
  gl.uniform1f(at.u_length, lighting.length)
  gl.uniform3f(at.u_shade, ...lighting.shade)
  gl.uniform1f(at.u_alpha, lighting.shadowAlpha)
}

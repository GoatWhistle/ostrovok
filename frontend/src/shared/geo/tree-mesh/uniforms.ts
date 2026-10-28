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

export function treeUniforms(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  matrix: Float32Array,
  grow: number,
  lighting: TreeLight,
) {
  const at = (name: string) => gl.getUniformLocation(program, name)
  // biome-ignore lint/correctness/useHookAtTopLevel: WebGL useProgram is not a React hook
  gl.useProgram(program)
  gl.uniformMatrix4fv(at("u_matrix"), false, matrix)
  gl.uniform1f(at("u_grow"), grow)
  gl.uniform3f(at("u_sun"), ...lighting.sun)
  gl.uniform3f(at("u_light"), ...lighting.light)
  gl.uniform3f(at("u_ambient"), ...lighting.ambient)
  gl.uniform3fv(at("u_palette"), lighting.palette.flat())
  gl.uniform2f(at("u_direction"), ...lighting.direction)
  gl.uniform1f(at("u_length"), lighting.length)
  gl.uniform3f(at("u_shade"), ...lighting.shade)
  gl.uniform1f(at("u_alpha"), lighting.shadowAlpha)
}

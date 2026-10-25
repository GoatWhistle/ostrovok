export const HOTEL_ALBEDO = "/textures/hotel-albedo-v1.jpg"

export const VERTEX_SHADER = `#version 300 es
in vec3 a_position;
in vec3 a_normal;
in vec3 a_uv;
uniform mat4 u_matrix;
out vec3 v_normal;
out vec3 v_uv;
void main() {
  gl_Position = u_matrix * vec4(a_position, 1.0);
  v_normal = a_normal;
  v_uv = a_uv;
}`

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_texture;
uniform vec3 u_sun;
uniform float u_daylight;
in vec3 v_normal;
in vec3 v_uv;
out vec4 fragColor;
void main() {
  vec2 uv;
  if (v_uv.z > 0.5) {
    uv = (vec2(791.0, 638.0) + clamp(v_uv.xy, 0.0, 1.0) * vec2(457.0, 610.0)) / 1254.0;
  } else {
    uv = (vec2(3.0, 625.0) + vec2(fract(v_uv.x), -fract(v_uv.y)) * vec2(936.0, 536.0)) / 1254.0;
  }
  vec3 color = texture(u_texture, uv).rgb;
  float light = 0.68 + 0.32 * max(dot(normalize(v_normal), u_sun), 0.0);
  fragColor = vec4(color * light * u_daylight, 1.0);
}`

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) throw new Error("Building shader unavailable")
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(error ?? "Building shader compilation failed")
  }
  return shader
}

export function buildingProgram(gl: WebGL2RenderingContext) {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
  const program = gl.createProgram()
  if (!program) throw new Error("Building program unavailable")
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  gl.deleteShader(vertex)
  gl.deleteShader(fragment)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program)
    throw new Error("Building program linking failed")
  }
  return program
}

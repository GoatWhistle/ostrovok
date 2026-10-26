export const WINDOW_VERTEX = `#version 300 es
in vec3 a_position;
in vec2 a_wall;
in float a_seed;
uniform mat4 u_matrix;
out vec2 v_wall;
out float v_seed;
void main() {
  gl_Position = u_matrix * vec4(a_position, 1.0);
  v_wall = a_wall;
  v_seed = a_seed;
}`

export const WINDOW_FRAGMENT = `#version 300 es
precision highp float;
uniform float u_night;
uniform float u_fade;
uniform vec3 u_warm;
uniform vec3 u_cool;
in vec2 v_wall;
in float v_seed;
out vec4 fragColor;
float hash(vec2 cell) {
  return fract(sin(dot(cell, vec2(12.9898, 78.233)) + v_seed * 917.0) * 43758.5453);
}
void main() {
  vec2 grid = vec2(v_wall.x / 3.1, v_wall.y / 3.2);
  vec2 local = fract(grid);
  vec2 cell = floor(grid);
  float pane = step(0.22, local.x) * step(local.x, 0.72) * step(0.24, local.y) * step(local.y, 0.7);
  if (pane < 0.5) discard;
  float chance = hash(cell);
  float lit = step(1.0 - mix(0.1, 0.5, u_night), chance);
  vec3 tint = mix(u_cool, u_warm, step(0.42, fract(chance * 7.31)));
  float alpha = u_fade * mix(0.1, mix(0.18, 0.92, u_night), lit);
  if (alpha < 0.02) discard;
  fragColor = vec4(tint * mix(0.32, 1.0, lit) * alpha, alpha);
}`

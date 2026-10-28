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
uniform float u_density;
uniform float u_glass;
uniform vec3 u_warm;
uniform vec3 u_cool;
in vec2 v_wall;
in float v_seed;
out vec4 fragColor;
const vec2 PANE_FROM = vec2(0.27, 0.3);
const vec2 PANE_TO = vec2(0.73, 0.7);
float hash(vec2 cell) {
  return fract(sin(dot(cell, vec2(12.9898, 78.233)) + fract(v_seed) * 917.0) * 43758.5453);
}
vec4 facade(vec2 local, vec2 cell) {
  float shop = step(1.0, v_seed) * step(cell.y, 0.5);
  float door = step(cell.y, 0.5) * step(mix(0.84, 0.7, shop), hash(vec2(cell.x, 41.0)));
  float upper = step(0.22, local.x) * step(local.x, 0.72) * step(0.24, local.y) * step(local.y, 0.7);
  float front = step(0.06, local.x) * step(local.x, 0.94) * step(0.1, local.y) * step(local.y, 0.8);
  float window = mix(upper, front, shop);
  float entry = step(0.3, local.x) * step(local.x, 0.68) * step(local.y, 0.7);
  if (mix(window, entry, door) < 0.5) discard;
  float chance = hash(cell);
  float lit = (1.0 - door) * step(1.0 - mix(0.1, 0.5, u_night) * u_density, chance);
  vec3 glass = u_cool * (0.84 + 0.28 * fract(chance * 3.7)) * mix(1.0, 0.42, u_night);
  glass *= mix(1.0, 0.6, door);
  vec3 lamp = u_warm * mix(1.0, 0.86, fract(chance * 5.1));
  float shine = lit * u_night;
  return vec4(mix(glass, lamp, shine), u_fade * mix(0.7, 0.95, shine));
}
vec4 glow(vec2 local, vec2 cell, vec2 width) {
  vec2 inside = smoothstep(PANE_FROM - width, PANE_FROM + width, local)
    * (1.0 - smoothstep(PANE_TO - width, PANE_TO + width, local));
  float pane = inside.x * inside.y;
  vec2 outside = max(max(PANE_FROM - local, local - PANE_TO), 0.0);
  float halo = (1.0 - smoothstep(0.0, 0.2, length(outside))) * (1.0 - pane);
  float chance = hash(cell);
  float lit = step(1.0 - mix(0.04, 0.38, u_night) * u_density, chance);
  float level = 0.55 + 0.45 * fract(chance * 3.7);
  float cold = step(0.8, fract(chance * 7.31));
  vec3 light = mix(u_warm, mix(u_cool, vec3(1.0), 0.55), cold) * level;
  vec3 color = mix(u_cool * 0.1, light, lit);
  float alpha = pane * mix(0.3, 0.92 * level, lit) + halo * lit * u_night * 0.22 * level;
  return vec4(color, u_fade * alpha);
}
void main() {
  vec2 grid = vec2(v_wall.x / 3.1, v_wall.y / 3.2);
  vec2 local = fract(grid);
  vec2 cell = floor(grid);
  vec2 width = fwidth(grid) * 0.75;
  vec4 tone = u_glass > 0.5 ? facade(local, cell) : glow(local, cell, width);
  if (tone.a < 0.02) discard;
  fragColor = vec4(tone.rgb * tone.a, tone.a);
}`

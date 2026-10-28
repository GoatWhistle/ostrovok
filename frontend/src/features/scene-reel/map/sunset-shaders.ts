export const GLITTER_VERTEX = `#version 300 es
in vec2 a_position;
uniform mat4 u_matrix;
uniform vec2 u_axis;
out vec2 v_local;
void main() {
  vec2 side = vec2(-u_axis.y, u_axis.x);
  v_local = vec2(dot(a_position, u_axis), dot(a_position, side));
  gl_Position = u_matrix * vec4(a_position, 0.5, 1.0);
}`

export const GLITTER_FRAGMENT = `#version 300 es
precision highp float;
uniform vec3 u_warm;
uniform vec3 u_hot;
uniform float u_time;
uniform float u_intensity;
uniform vec2 u_reach;
in vec2 v_local;
out vec4 fragColor;
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float sparkles(vec2 at, vec2 cell, float time) {
  vec2 grid = at / cell;
  vec2 id = floor(grid);
  vec2 inside = fract(grid) - 0.5;
  float seed = hash(id);
  float flicker = 0.5 + 0.5 * sin(time * (0.6 + seed * 1.4) + seed * 40.0);
  float streak = exp(-inside.x * inside.x * 18.0 - inside.y * inside.y * 3.0);
  return step(0.5, seed) * streak * flicker * flicker;
}
void main() {
  float along = v_local.x;
  float across = v_local.y;
  float travel = clamp((along - u_reach.x) / (u_reach.y - u_reach.x), 0.0, 1.0);
  float width = mix(22.0, 34.0, travel);
  float column = exp(-pow(across / width, 2.0) * 2.2);
  float ends = smoothstep(0.0, 0.12, travel) * (1.0 - smoothstep(0.9, 1.0, travel));
  vec2 at = vec2(along, across);
  vec2 cell = vec2(mix(1.4, 2.4, travel), mix(6.0, 11.0, travel));
  float fine = sparkles(at, cell, u_time) + 0.7 * sparkles(at + 17.0, cell * 0.6, u_time * 1.3);
  float blur = clamp(length(fwidth(at / cell)) * 1.1, 0.0, 1.0);
  float shimmer = mix(fine, 0.18, blur);
  float glow = 0.16 * column * (0.6 + travel * 0.4);
  float light = (shimmer * column + glow) * ends * u_intensity * mix(1.0, 1.8, travel);
  vec3 color = mix(u_warm, u_hot, 0.35 + 0.65 * shimmer) * light;
  fragColor = vec4(color, min(1.0, light * 0.55));
}`

export const SUN_VERTEX = `#version 300 es
in vec2 a_corner;
uniform mat4 u_matrix;
uniform vec3 u_anchor;
uniform vec2 u_size;
out vec2 v_corner;
void main() {
  vec4 clip = u_matrix * vec4(u_anchor, 1.0);
  clip.xy += a_corner * u_size * clip.w;
  gl_Position = clip;
  v_corner = a_corner;
}`

export const SUN_FRAGMENT = `#version 300 es
precision highp float;
uniform vec3 u_warm;
uniform vec3 u_hot;
uniform vec3 u_core;
uniform float u_intensity;
in vec2 v_corner;
out vec4 fragColor;
const float DISC = 0.26;
void main() {
  float r = length(v_corner);
  float above = smoothstep(-0.035, 0.02, v_corner.y);
  float limb = sqrt(max(0.0, 1.0 - pow(min(r / DISC, 1.0), 2.0)));
  float disc = 1.0 - smoothstep(DISC * 0.94, DISC * 1.04, r);
  float redden = smoothstep(0.24, 0.0, v_corner.y);
  vec3 face = mix(u_hot, u_core, pow(limb, 0.6));
  face = mix(face, u_warm, redden * 0.55);
  float edge = 1.0 - smoothstep(0.6, 1.0, max(abs(v_corner.x), abs(v_corner.y)));
  float bloom = exp(-r * r * 14.0) * 0.32 + exp(-r * r * 4.5) * 0.12;
  float band = exp(-v_corner.y * v_corner.y * 90.0) * exp(-v_corner.x * v_corner.x * 1.6) * 0.24;
  vec3 halo = (u_hot * bloom * mix(0.3, 1.0, above) + u_warm * band) * edge;
  float cover = disc * above;
  fragColor = vec4((face * cover + halo) * u_intensity, cover * u_intensity);
}`

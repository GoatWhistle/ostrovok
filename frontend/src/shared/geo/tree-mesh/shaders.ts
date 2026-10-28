import { PICK_SPREAD } from "./instances"
import { MIN_KEEP } from "./selection"

const EDGE = `
uniform vec2 u_reach;
float edgeFade(vec2 at) {
  return 1.0 - smoothstep(u_reach.y * 0.86, u_reach.y, length(at));
}`

export const TREE_VERTEX = `#version 300 es
in vec3 a_position;
in vec3 a_normal;
in float a_part;
in vec3 a_offset;
in float a_size;
in float a_tone;
in float a_spin;
uniform mat4 u_matrix;
uniform float u_grow;
uniform vec3 u_camera;
${EDGE}
out vec3 v_normal;
out float v_tone;
out float v_part;
out float v_level;
void main() {
  float edge = edgeFade(a_offset.xy);
  float keep = clamp(u_reach.x / max(distance(a_offset, u_camera), 1.0), ${MIN_KEEP}, 1.0);
  v_tone = a_tone;
  v_part = a_part;
  v_level = a_position.z;
  v_normal = vec3(0.0, 0.0, 1.0);
  if (edge <= 0.0 || fract(a_spin * ${PICK_SPREAD}) >= keep) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }
  float c = cos(a_spin);
  float s = sin(a_spin);
  vec3 p = a_position * a_size * u_grow * edge * min(inversesqrt(keep), 1.7);
  vec2 r = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  v_normal = vec3(c * a_normal.x - s * a_normal.y, s * a_normal.x + c * a_normal.y, a_normal.z);
  gl_Position = u_matrix * vec4(a_offset.xy + r, a_offset.z + p.z, 1.0);
}`

export const TREE_FRAGMENT = `#version 300 es
precision highp float;
uniform vec3 u_sun;
uniform vec3 u_light;
uniform vec3 u_ambient;
uniform vec3 u_palette[6];
uniform float u_conifer;
in vec3 v_normal;
in float v_tone;
in float v_part;
in float v_level;
out vec4 fragColor;
void main() {
  vec3 n = normalize(v_normal);
  int tone = u_conifer > 0.5 ? 4 : int(v_tone + 0.5);
  vec3 leaf = u_palette[tone] * (u_conifer > 0.5 ? 0.9 + 0.1 * v_tone : 1.0);
  vec3 albedo = v_part > 0.5 ? u_palette[5] : leaf;
  float diffuse = max(dot(n, u_sun), 0.0);
  float occlusion = v_part > 0.5 ? 0.8 : mix(0.72, 1.06, smoothstep(0.25, 0.95, v_level));
  vec3 color = albedo * (u_ambient * (1.0 + 0.15 * max(n.z, 0.0)) + u_light * diffuse) * occlusion;
  fragColor = vec4(color, 1.0);
}`

export const SHADOW_VERTEX = `#version 300 es
in vec2 a_corner;
in vec3 a_offset;
in float a_size;
uniform mat4 u_matrix;
uniform vec2 u_direction;
uniform float u_length;
uniform float u_grow;
${EDGE}
out vec2 v_corner;
void main() {
  vec2 side = vec2(-u_direction.y, u_direction.x);
  float radius = a_size * 0.32 * u_grow * edgeFade(a_offset.xy);
  vec2 local = a_corner.x * side * radius + a_corner.y * u_direction * radius * (1.0 + u_length);
  vec2 center = u_direction * radius * 1.40625 * u_length;
  gl_Position = u_matrix * vec4(a_offset.xy + center + local, a_offset.z + 0.2, 1.0);
  v_corner = a_corner;
}`

export const SHADOW_FRAGMENT = `#version 300 es
precision highp float;
uniform vec3 u_shade;
uniform float u_alpha;
in vec2 v_corner;
out vec4 fragColor;
void main() {
  float alpha = u_alpha * (1.0 - smoothstep(0.35, 1.0, length(v_corner)));
  if (alpha < 0.01) discard;
  fragColor = vec4(u_shade * alpha, alpha);
}`

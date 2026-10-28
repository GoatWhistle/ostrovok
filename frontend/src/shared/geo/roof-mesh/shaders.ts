export const ROOF_VERTEX = `#version 300 es
in vec3 a_position;
in vec3 a_normal;
in float a_tone;
in float a_base;
uniform mat4 u_matrix;
uniform float u_grow;
out vec3 v_normal;
out float v_tone;
out float v_height;
out float v_rise;
void main() {
  float z = a_base + (a_position.z - a_base) * u_grow;
  gl_Position = u_matrix * vec4(a_position.xy, z, 1.0);
  v_normal = a_normal;
  v_tone = a_tone;
  v_height = a_position.z;
  v_rise = a_position.z - a_base;
}`

export const ROOF_FRAGMENT = `#version 300 es
precision highp float;
uniform vec3 u_sun;
uniform vec3 u_light;
uniform vec3 u_ambient;
uniform vec3 u_palette[16];
in vec3 v_normal;
in float v_tone;
in float v_height;
in float v_rise;
out vec4 fragColor;
void main() {
  vec3 n = normalize(v_normal);
  int tone = int(v_tone + 0.5);
  vec3 albedo = u_palette[tone];
  float diffuse = max(dot(n, u_sun), 0.0);
  float sloped = step(0.25, n.z) * step(n.z, 0.97) * step(float(tone), 4.5);
  float rows = v_height * 2.8;
  float fade = clamp(1.0 - fwidth(rows) * 1.6, 0.0, 1.0);
  float course = 1.0 - 0.07 * sloped * fade * step(0.62, fract(rows));
  float plaster = step(9.5, float(tone)) * step(abs(n.z), 0.2);
  float occlusion = mix(1.0, mix(0.74, 1.0, smoothstep(0.0, 3.2, v_rise)), plaster);
  float skylight = 1.0 + 0.18 * max(n.z, 0.0);
  vec3 color = albedo * (u_ambient * skylight + u_light * diffuse) * course * occlusion;
  fragColor = vec4(color, 1.0);
}`

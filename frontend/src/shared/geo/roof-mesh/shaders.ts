export const ROOF_VERTEX = `#version 300 es
in vec3 a_position;
in vec3 a_normal;
in float a_tone;
in float a_base;
uniform mat4 u_matrix;
uniform float u_grow;
uniform vec2 u_fog_depth;
out vec3 v_normal;
out float v_fog;
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
  v_fog = (u_fog_depth.x - u_fog_depth.y / gl_Position.w) * 0.5 + 0.5;
}`

export const ROOF_FRAGMENT = `#version 300 es
precision highp float;
uniform vec3 u_sun;
uniform vec3 u_light;
uniform vec3 u_ambient;
uniform vec3 u_palette[16];
uniform vec3 u_fog_color;
uniform vec3 u_horizon_color;
uniform vec3 u_fog_blend;
in vec3 v_normal;
in float v_fog;
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
  float ground = u_fog_blend.x;
  float horizon = u_fog_blend.y;
  float far = max(v_fog - ground, 0.0) / max(1.0 - ground, 0.0001);
  if (u_fog_blend.z > 0.0 && far > 0.985) discard;
  float tint = smoothstep(0.0, 1.0, max((v_fog - horizon) / max(1.0 - horizon, 0.0001), 0.0));
  vec3 haze = mix(pow(u_fog_color, vec3(2.2)), pow(u_horizon_color, vec3(2.2)), tint);
  float amount = v_fog > ground ? far * far * u_fog_blend.z : 0.0;
  fragColor = vec4(pow(mix(pow(color, vec3(2.2)), haze, amount), vec3(1.0 / 2.2)), 1.0);
}`

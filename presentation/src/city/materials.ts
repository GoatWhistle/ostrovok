import {
  AdditiveBlending,
  BackSide,
  Color,
  DoubleSide,
  MeshLambertMaterial,
  ShaderMaterial,
  type WebGLProgramParametersWithUniforms,
} from "three"
import { token } from "./palette"

export interface NightUniform {
  value: number
}

export function buildingMaterial(night: NightUniform, grow: { value: number }) {
  const material = new MeshLambertMaterial({ vertexColors: true, side: DoubleSide })
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uNight = night
    shader.uniforms.uGrow = grow
    shader.uniforms.uWindow = { value: token("--map-toy-window").clone() }
    shader.uniforms.uGlass = { value: token("--map-toy-glass").clone() }
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute vec4 aWall;\nvarying vec4 vWall;\nuniform float uGrow;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvWall = aWall;\ntransformed.y *= uGrow;",
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec4 vWall;
uniform float uNight;
uniform vec3 uWindow;
uniform vec3 uGlass;
float cellHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
float windowMask = 0.0;
float lit = 0.0;
if (vWall.y > 1.4 && vWall.w > 4.0) {
  float floorIndex = floor((vWall.y - 0.6) / 3.1);
  float columnIndex = floor(vWall.x / 3.2);
  vec2 cell = vec2(fract(vWall.x / 3.2), fract((vWall.y - 0.6) / 3.1));
  float inside = step(0.22, cell.x) * step(cell.x, 0.78) * step(0.28, cell.y) * step(cell.y, 0.78);
  float roofGap = step(vWall.y, vWall.w - 0.6);
  vec2 footprint = fwidth(vec2(vWall.x / 3.2, (vWall.y - 0.6) / 3.1));
  float detail = 1.0 - smoothstep(0.18, 0.4, max(footprint.x, footprint.y));
  windowMask = inside * roofGap * detail;
  lit = step(0.42, cellHash(vec3(floorIndex, columnIndex, vWall.z)));
}
diffuseColor.rgb = mix(diffuseColor.rgb, uGlass, windowMask * 0.55 * (1.0 - uNight * 0.6));
totalEmissiveRadiance += uWindow * windowMask * lit * uNight * 1.35;
totalEmissiveRadiance += diffuseColor.rgb * 0.06 * uNight;`,
      )
  }
  return material
}

export function flatMaterial() {
  return new MeshLambertMaterial({ vertexColors: true, side: DoubleSide, depthWrite: false })
}

export function treeMaterial() {
  return new MeshLambertMaterial({ vertexColors: true, flatShading: true })
}

export function skyMaterial() {
  return new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uZenith: { value: new Color() },
      uHorizon: { value: new Color() },
      uGlow: { value: new Color() },
      uSun: { value: [0, 1, 0] },
      uGlowStrength: { value: 0 },
    },
    vertexShader: `
varying vec3 vDirection;
void main() {
  vDirection = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position.z = gl_Position.w;
}`,
    fragmentShader: `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGlow;
uniform vec3 uSun;
uniform float uGlowStrength;
varying vec3 vDirection;
void main() {
  float height = clamp(vDirection.y, -0.2, 1.0);
  vec3 color = mix(uHorizon, uZenith, pow(smoothstep(-0.02, 0.6, height), 0.7));
  float sunDot = max(dot(normalize(vDirection), normalize(uSun)), 0.0);
  color += uGlow * (pow(sunDot, 24.0) * 0.7 + pow(sunDot, 600.0) * 1.4) * uGlowStrength;
  gl_FragColor = vec4(color, 1.0);
}`,
  })
}

export function seaMaterial() {
  return new ShaderMaterial({
    fog: true,
    uniforms: {
      uColor: { value: new Color() },
      uDeep: { value: new Color() },
      uSun: { value: [0, 1, 0] },
      uSunColor: { value: new Color() },
      uTime: { value: 0 },
      uNight: { value: 0 },
      fogColor: { value: new Color() },
      fogNear: { value: 1 },
      fogFar: { value: 2000 },
    },
    vertexShader: `
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: `
uniform vec3 uColor;
uniform vec3 uDeep;
uniform vec3 uSun;
uniform vec3 uSunColor;
uniform float uTime;
uniform float uNight;
varying vec3 vWorld;
#include <fog_pars_fragment>
void main() {
  vec2 p = vWorld.xz * 0.045;
  float wave = sin(p.x * 1.7 + uTime * 0.9) * 0.5 + sin(p.y * 2.3 - uTime * 0.7) * 0.5 + sin((p.x + p.y) * 3.1 + uTime * 1.3) * 0.25;
  vec3 normal = normalize(vec3(cos(p.x * 1.7 + uTime) * 0.08, 1.0, cos(p.y * 2.3 - uTime) * 0.08));
  vec3 view = normalize(cameraPosition - vWorld);
  vec3 halfway = normalize(normalize(uSun) + view);
  float spec = pow(max(dot(normal, halfway), 0.0), 180.0) * step(0.0, uSun.y);
  float fresnel = pow(1.0 - max(view.y, 0.0), 3.0);
  vec3 color = mix(uColor, uDeep, fresnel * 0.6) + wave * 0.012;
  color += uSunColor * spec * 0.9;
  gl_FragColor = vec4(color, 1.0);
  #include <fog_fragment>
}`,
  })
}

export function lampMaterial(night: NightUniform) {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uNight: night, uColor: { value: token("--map-toy-lamp").clone() }, uScale: { value: 900 } },
    vertexShader: `
uniform float uScale;
void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(uScale / -mvPosition.z, 1.0, 26.0);
  gl_Position = projectionMatrix * mvPosition;
}`,
    fragmentShader: `
uniform float uNight;
uniform vec3 uColor;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float glow = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(uColor * glow * glow * 1.6, glow * uNight);
}`,
  })
}

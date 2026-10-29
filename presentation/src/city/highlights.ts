import {
  NormalBlending,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  ShaderMaterial,
} from "three"
import type { Flat } from "./city-data"

export function glowMaterial(color: Color, strength = 1) {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: NormalBlending,
    uniforms: {
      uColor: { value: color.clone() },
      uOpacity: { value: 0 },
      uProgress: { value: 1 },
      uTime: { value: 0 },
      uStrength: { value: strength },
    },
    vertexShader: `
attribute vec2 aLine;
varying vec2 vLine;
void main() {
  vLine = aLine;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  #ifdef USE_INSTANCING
  mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  #endif
  gl_Position = projectionMatrix * mvPosition;
}`,
    fragmentShader: `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uProgress;
uniform float uTime;
uniform float uStrength;
varying vec2 vLine;
void main() {
  if (vLine.x > uProgress) discard;
  float edge = 1.0 - abs(vLine.y * 2.0 - 1.0);
  float core = smoothstep(0.0, 0.55, edge);
  float pulse = 1.0;
  gl_FragColor = vec4(uColor * (0.85 + core * 0.25) * pulse, clamp((0.35 + core * 0.65) * uStrength, 0.0, 1.0) * uOpacity);
}`,
  })
}

export function ribbon(lines: readonly Flat[], width: number, height: number): BufferGeometry {
  const positions: number[] = []
  const meta: number[] = []
  for (const flat of lines) {
    let total = 0
    for (let i = 0; i + 3 < flat.length; i += 2)
      total += Math.hypot((flat[i + 2] ?? 0) - (flat[i] ?? 0), (flat[i + 3] ?? 0) - (flat[i + 1] ?? 0))
    let walked = 0
    for (let i = 0; i + 3 < flat.length; i += 2) {
      const ax = flat[i] ?? 0
      const az = -(flat[i + 1] ?? 0)
      const bx = flat[i + 2] ?? 0
      const bz = -(flat[i + 3] ?? 0)
      const length = Math.hypot(bx - ax, bz - az)
      if (length < 0.01) continue
      const nx = (-(bz - az) / length) * (width / 2)
      const nz = ((bx - ax) / length) * (width / 2)
      const t0 = total ? walked / total : 0
      const t1 = total ? (walked + length) / total : 1
      walked += length
      const quad = [
        [ax - nx, az - nz, t0, 0],
        [bx - nx, bz - nz, t1, 0],
        [bx + nx, bz + nz, t1, 1],
        [ax + nx, az + nz, t0, 1],
      ]
      for (const index of [0, 1, 2, 0, 2, 3]) {
        const point = quad[index] ?? [0, 0, 0, 0]
        positions.push(point[0] ?? 0, height, point[1] ?? 0)
        meta.push(point[2] ?? 0, point[3] ?? 0)
      }
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3))
  geometry.setAttribute("aLine", new Float32BufferAttribute(meta, 2))
  return geometry
}

export function walls(lines: readonly Flat[], height: number): BufferGeometry {
  const positions: number[] = []
  const meta: number[] = []
  for (const flat of lines) {
    for (let i = 0; i + 3 < flat.length; i += 2) {
      const ax = flat[i] ?? 0
      const az = -(flat[i + 1] ?? 0)
      const bx = flat[i + 2] ?? 0
      const bz = -(flat[i + 3] ?? 0)
      const quad = [
        [ax, 0, az, 0, 0],
        [bx, 0, bz, 1, 0],
        [bx, height, bz, 1, 1],
        [ax, height, az, 0, 1],
      ]
      for (const index of [0, 1, 2, 0, 2, 3]) {
        const point = quad[index] ?? [0, 0, 0, 0, 0]
        positions.push(point[0] ?? 0, point[1] ?? 0, point[2] ?? 0)
        meta.push(point[3] ?? 0, 0.5 + (point[4] ?? 0) * 0.5)
      }
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3))
  geometry.setAttribute("aLine", new Float32BufferAttribute(meta, 2))
  return geometry
}

export function beams(points: readonly (readonly [number, number, number])[], color: Color, height: number) {
  const geometry = new CylinderGeometry(2.2, 2.2, height, 10, 1, true)
  geometry.translate(0, height / 2, 0)
  const count = geometry.getAttribute("position").count
  const meta = new Float32Array(count * 2)
  const position = geometry.getAttribute("position")
  for (let i = 0; i < count; i++) {
    meta[i * 2] = 0
    meta[i * 2 + 1] = 0.5 + (1 - position.getY(i) / height) * 0.5
  }
  geometry.setAttribute("aLine", new Float32BufferAttribute(meta, 2))
  const material = glowMaterial(color, 0.9)
  const mesh = new InstancedMesh(geometry, material, Math.max(1, points.length))
  const matrix = new Matrix4()
  points.forEach(([x, y, base], index) => {
    matrix.makeTranslation(x, base, -y)
    mesh.setMatrixAt(index, matrix)
  })
  mesh.count = points.length
  mesh.frustumCulled = false
  return mesh
}

export class Fader {
  readonly group = new Group()
  private current = 0
  private target = 0
  private readonly materials: ShaderMaterial[]

  private readonly draw: number

  constructor(meshes: readonly Mesh[], draw = 0) {
    this.draw = draw
    this.materials = meshes.map((mesh) => mesh.material as ShaderMaterial)
    for (const mesh of meshes) this.group.add(mesh)
    this.group.visible = false
  }

  set(on: boolean, restart = false) {
    this.target = on ? 1 : 0
    if (on && restart && this.draw > 0)
      for (const material of this.materials) if (material.uniforms.uProgress) material.uniforms.uProgress.value = 0
  }

  update(delta: number, time: number) {
    const draw = this.draw
    this.current += (this.target - this.current) * Math.min(1, delta * 3.5)
    this.group.visible = this.current > 0.01
    for (const material of this.materials) {
      const uniforms = material.uniforms
      if (uniforms.uOpacity) uniforms.uOpacity.value = this.current
      if (uniforms.uTime) uniforms.uTime.value = time
      if (draw > 0 && uniforms.uProgress && this.target > 0)
        uniforms.uProgress.value = Math.min(1, (uniforms.uProgress.value as number) + delta / draw)
    }
  }
}

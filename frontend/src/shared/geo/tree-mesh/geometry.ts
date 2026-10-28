type Vec3 = readonly [number, number, number]

export const TREE_STRIDE = 7
const PHI = (1 + Math.sqrt(5)) / 2
const ICO: readonly Vec3[] = [
  [-1, PHI, 0],
  [1, PHI, 0],
  [-1, -PHI, 0],
  [1, -PHI, 0],
  [0, -1, PHI],
  [0, 1, PHI],
  [0, -1, -PHI],
  [0, 1, -PHI],
  [PHI, 0, -1],
  [PHI, 0, 1],
  [-PHI, 0, -1],
  [-PHI, 0, 1],
]
const ICO_FACES = [
  [0, 11, 5],
  [0, 5, 1],
  [0, 1, 7],
  [0, 7, 10],
  [0, 10, 11],
  [1, 5, 9],
  [5, 11, 4],
  [11, 10, 2],
  [10, 7, 6],
  [7, 1, 8],
  [3, 9, 4],
  [3, 4, 2],
  [3, 2, 6],
  [3, 6, 8],
  [3, 8, 9],
  [4, 9, 5],
  [2, 4, 11],
  [6, 2, 10],
  [8, 6, 7],
  [9, 8, 1],
] as const

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function normal(a: Vec3, b: Vec3, c: Vec3, pivot: Vec3): Vec3 {
  const [ux, uy, uz] = sub(b, a)
  const [vx, vy, vz] = sub(c, a)
  const n: Vec3 = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]
  const [mx, my, mz] = sub(
    [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3],
    pivot,
  )
  const sign = n[0] * mx + n[1] * my + n[2] * mz < 0 ? -1 : 1
  const length = Math.hypot(...n) * sign
  return [n[0] / length, n[1] / length, n[2] / length]
}

function triangle(out: number[], a: Vec3, b: Vec3, c: Vec3, part: number, pivot: Vec3) {
  const [nx, ny, nz] = normal(a, b, c, pivot)
  for (const p of [a, b, c]) out.push(p[0], p[1], p[2], nx, ny, nz, part)
}

function blob(out: number[], center: Vec3, radius: number, height: number, part = 0) {
  const scale = 1 / Math.hypot(1, PHI)
  const place = ([x, y, z]: Vec3): Vec3 => [
    center[0] + x * scale * radius,
    center[1] + y * scale * radius,
    center[2] + z * scale * height,
  ]
  for (const [a, b, c] of ICO_FACES)
    triangle(
      out,
      place(ICO[a] ?? [0, 0, 0]),
      place(ICO[b] ?? [0, 0, 0]),
      place(ICO[c] ?? [0, 0, 0]),
      part,
      center,
    )
}

const OCTA: readonly Vec3[] = [
  [1, 0, 0],
  [0, 1, 0],
  [-1, 0, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
]

function octahedron(out: number[], center: Vec3, radius: number, height: number) {
  const place = ([x, y, z]: Vec3): Vec3 => [
    center[0] + x * radius,
    center[1] + y * radius,
    center[2] + z * height,
  ]
  for (let index = 0; index < 4; index += 1) {
    const a = place(OCTA[index] ?? [0, 0, 0])
    const b = place(OCTA[(index + 1) % 4] ?? [0, 0, 0])
    triangle(out, a, b, place([0, 0, 1]), 0, center)
    triangle(out, b, a, place([0, 0, -1]), 0, center)
  }
}

function prism(out: number[], half: number, from: number, to: number, sides = 4) {
  const ring = Array.from({ length: sides }, (_, index) => {
    const angle = (index / sides) * Math.PI * 2 + Math.PI / sides
    return [Math.cos(angle) * half, Math.sin(angle) * half] as const
  })
  const pivot: Vec3 = [0, 0, (from + to) / 2]
  for (let index = 0; index < sides; index += 1) {
    const [x1, y1] = ring[index] ?? [0, 0]
    const [x2, y2] = ring[(index + 1) % sides] ?? [0, 0]
    triangle(out, [x1, y1, from], [x2, y2, from], [x2, y2, to], 1, pivot)
    triangle(out, [x1, y1, from], [x2, y2, to], [x1, y1, to], 1, pivot)
  }
}

function cone(out: number[], base: number, radius: number, apex: number, sides = 7) {
  const pivot: Vec3 = [0, 0, base + (apex - base) * 0.3]
  for (let index = 0; index < sides; index += 1) {
    const a1 = (index / sides) * Math.PI * 2
    const a2 = ((index + 1) / sides) * Math.PI * 2
    const p1: Vec3 = [Math.cos(a1) * radius, Math.sin(a1) * radius, base]
    const p2: Vec3 = [Math.cos(a2) * radius, Math.sin(a2) * radius, base]
    triangle(out, p1, p2, [0, 0, apex], 0, pivot)
    triangle(out, p2, p1, [0, 0, base], 0, [0, 0, apex])
  }
}

export function broadleaf(): Float32Array {
  const out: number[] = []
  prism(out, 0.045, 0, 0.5)
  blob(out, [0, 0, 0.62], 0.36, 0.38)
  blob(out, [0.12, 0.06, 0.78], 0.2, 0.2)
  return new Float32Array(out)
}

export function conifer(): Float32Array {
  const out: number[] = []
  prism(out, 0.04, 0, 0.3)
  cone(out, 0.2, 0.3, 0.75)
  cone(out, 0.46, 0.22, 1)
  return new Float32Array(out)
}

export function bush(): Float32Array {
  const out: number[] = []
  blob(out, [0, 0, 0.45], 0.55, 0.5)
  return new Float32Array(out)
}

export const SHADOW_QUAD = new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1])

export function broadleafFar(): Float32Array {
  const out: number[] = []
  octahedron(out, [0.03, 0.02, 0.64], 0.4, 0.4)
  return new Float32Array(out)
}

export function coniferFar(): Float32Array {
  const out: number[] = []
  cone(out, 0.2, 0.3, 1, 5)
  return new Float32Array(out)
}

export function bushFar(): Float32Array {
  const out: number[] = []
  octahedron(out, [0, 0, 0.45], 0.55, 0.5)
  return new Float32Array(out)
}

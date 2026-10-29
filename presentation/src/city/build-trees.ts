import {
  BufferGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  InstancedMesh,
  type Material,
  Matrix4,
  Quaternion,
  Vector3,
} from "three"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import { CITY, type Flat, insidePolygon, polygonArea } from "./city-data"
import { hash, LEAVES, token } from "./palette"

const DENSITY: Readonly<Record<string, number>> = {
  forest: 90,
  wood: 90,
  park: 170,
  garden: 260,
  cemetery: 220,
  scrub: 300,
  grass: 900,
  wetland: 500,
}
const LIMIT = 15000

function treeGeometry(): BufferGeometry {
  const canopy = new IcosahedronGeometry(1, 0)
  canopy.translate(0, 1.55, 0)
  const trunk = new CylinderGeometry(0.12, 0.16, 1, 5)
  trunk.translate(0, 0.5, 0)
  const paint = (geometry: BufferGeometry, color: Color) => {
    const count = geometry.getAttribute("position").count
    const colors = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3))
    return geometry.toNonIndexed()
  }
  const merged = mergeGeometries([
    paint(canopy.toNonIndexed(), new Color(1, 1, 1)),
    paint(trunk.toNonIndexed(), token("--map-toy-trunk").clone().multiplyScalar(0.9)),
  ])
  merged.computeVertexNormals()
  return merged
}

function scatter(points: number[]) {
  let seed = 1
  for (const [kind, flat] of CITY.cover) {
    const density = DENSITY[kind]
    if (!density) continue
    const area = Math.abs(polygonArea(flat))
    const count = Math.min(1200, Math.floor(area / density))
    if (count < 1) continue
    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    for (let i = 0; i < flat.length; i += 2) {
      minX = Math.min(minX, flat[i] ?? 0)
      maxX = Math.max(maxX, flat[i] ?? 0)
      minY = Math.min(minY, flat[i + 1] ?? 0)
      maxY = Math.max(maxY, flat[i + 1] ?? 0)
    }
    let placed = 0
    for (let attempt = 0; attempt < count * 3 && placed < count; attempt++) {
      seed += 1
      const x = minX + hash(seed * 1.31) * (maxX - minX)
      const y = minY + hash(seed * 2.17) * (maxY - minY)
      if (!insidePolygon(x, y, flat as Flat)) continue
      points.push(x, y)
      placed += 1
      if (points.length / 2 >= LIMIT) return
    }
  }
}

export function buildTrees(material: Material) {
  const points: number[] = [...CITY.trees]
  scatter(points)
  const count = points.length / 2
  const mesh = new InstancedMesh(treeGeometry(), material, count)
  const matrix = new Matrix4()
  const rotation = new Quaternion()
  const up = new Vector3(0, 1, 0)
  for (let i = 0; i < count; i++) {
    const x = points[i * 2] ?? 0
    const y = points[i * 2 + 1] ?? 0
    const size = 2.2 + hash(i * 3.7) * 2.6
    rotation.setFromAxisAngle(up, hash(i * 5.3) * Math.PI * 2)
    matrix.compose(
      new Vector3(x, 0, -y),
      rotation,
      new Vector3(size * (0.85 + hash(i) * 0.3), size * (1 + hash(i * 1.9) * 0.5), size * (0.85 + hash(i * 2.3) * 0.3)),
    )
    mesh.setMatrixAt(i, matrix)
    mesh.setColorAt(i, LEAVES.length ? token(LEAVES[i % LEAVES.length] ?? "--map-toy-leaf") : new Color())
  }
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.castShadow = false
  mesh.receiveShadow = true
  return { mesh, count }
}

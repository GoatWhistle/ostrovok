export type Local = readonly [number, number]
export type TreeKind = 0 | 1 | 2

export interface TreeRule {
  readonly spacing: number
  readonly conifer: number
  readonly bush: number
  readonly keep: number
  readonly height: readonly [number, number]
}

export interface Tree {
  readonly x: number
  readonly y: number
  readonly kind: TreeKind
  readonly height: number
  readonly tone: number
  readonly spin: number
}

export const LEAF_TONES = 4
const JITTER = 0.42
const BUSH_HEIGHT: readonly [number, number] = [1.1, 2.2]

export function hash2(i: number, j: number, salt: number): number {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(salt, 2147483647)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function crossings(rings: readonly (readonly Local[])[], y: number): number[] {
  const xs: number[] = []
  for (const ring of rings)
    for (let index = 0; index + 1 < ring.length; index += 1) {
      const [x1, y1] = ring[index] ?? [0, 0]
      const [x2, y2] = ring[index + 1] ?? [0, 0]
      if (y1 > y !== y2 > y) xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1))
    }
  return xs.sort((a, b) => a - b)
}

export function fillCells(
  rings: readonly (readonly Local[])[],
  step: number,
  visit: (i: number, j: number) => void,
) {
  let low = Number.POSITIVE_INFINITY
  let high = Number.NEGATIVE_INFINITY
  for (const ring of rings)
    for (const [, y] of ring) {
      low = Math.min(low, y)
      high = Math.max(high, y)
    }
  for (let j = Math.floor(low / step); j * step <= high; j += 1) {
    const xs = crossings(rings, (j + 0.5) * step)
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const from = Math.ceil((xs[k] ?? 0) / step - 0.5)
      const to = Math.floor((xs[k + 1] ?? 0) / step - 0.5)
      for (let i = from; i <= to; i += 1) visit(i, j)
    }
  }
}

export function treeAt(i: number, j: number, rule: TreeRule): Tree | undefined {
  if (hash2(i, j, 1) > rule.keep) return undefined
  const roll = hash2(i, j, 2)
  const kind: TreeKind = roll < rule.bush ? 2 : roll < rule.bush + rule.conifer ? 1 : 0
  const [min, max] = kind === 2 ? BUSH_HEIGHT : rule.height
  return {
    x: (i + 0.5 + (hash2(i, j, 3) - 0.5) * 2 * JITTER) * rule.spacing,
    y: (j + 0.5 + (hash2(i, j, 4) - 0.5) * 2 * JITTER) * rule.spacing,
    kind,
    height: min + (max - min) * hash2(i, j, 5),
    tone: Math.floor(hash2(i, j, 6) * LEAF_TONES),
    spin: hash2(i, j, 7) * Math.PI * 2,
  }
}

export const RULES: Readonly<Record<string, TreeRule>> = {
  wood: { spacing: 8, conifer: 0.35, bush: 0.08, keep: 0.92, height: [8, 14] },
  forest: { spacing: 8, conifer: 0.45, bush: 0.05, keep: 0.92, height: [9, 15] },
  park: { spacing: 10, conifer: 0.15, bush: 0.22, keep: 0.82, height: [6, 12] },
  garden: { spacing: 10, conifer: 0.08, bush: 0.4, keep: 0.75, height: [4, 7] },
  cemetery: { spacing: 9, conifer: 0.6, bush: 0.1, keep: 0.8, height: [6, 11] },
  scrub: { spacing: 5, conifer: 0.05, bush: 0.85, keep: 0.7, height: [3, 5] },
  grass: { spacing: 12, conifer: 0.1, bush: 0.5, keep: 0.55, height: [4, 8] },
  residential: { spacing: 9, conifer: 0.12, bush: 0.35, keep: 0.42, height: [4, 9] },
  default_ground: { spacing: 11, conifer: 0.1, bush: 0.4, keep: 0.3, height: [4, 8] },
}

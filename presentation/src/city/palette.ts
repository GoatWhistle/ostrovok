import { Color } from "three"

const cache = new Map<string, Color>()

export function token(name: string): Color {
  const known = cache.get(name)
  if (known) return known
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const color = new Color(value || "#ff00ff")
  cache.set(name, color)
  return color
}

export const WALLS = [
  "--map-toy-plaster-white",
  "--map-toy-plaster-peach",
  "--map-toy-plaster-ochre",
  "--map-toy-plaster-sage",
  "--map-toy-plaster-rose",
  "--map-toy-wall",
  "--map-toy-peach",
]

export const ROOFS = [
  "--map-toy-roof",
  "--map-toy-roof-clay",
  "--map-toy-roof",
  "--map-toy-roof-slate",
  "--map-toy-roof-sage",
  "--map-toy-roof-sand",
  "--map-toy-brick",
]

export const FLAT_ROOFS = ["--map-toy-gravel", "--map-toy-gravel-warm", "--map-toy-gravel-cool", "--map-toy-roof-steel"]

export const LEAVES = [
  "--map-toy-leaf",
  "--map-toy-leaf-fresh",
  "--map-toy-leaf-deep",
  "--map-toy-leaf-olive",
  "--map-toy-conifer",
]

export function hash(value: number): number {
  const x = Math.sin(value * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

export function pick(list: readonly string[], seed: number): Color {
  return token(list[Math.floor(hash(seed) * list.length) % list.length] ?? list[0] ?? "--map-toy-wall")
}

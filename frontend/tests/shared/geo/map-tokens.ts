import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { APPEARANCES } from "../../../src/shared/geo/appearance/packages"
import type { MapColors } from "../../../src/shared/geo/appearance/palette-tokens"
import type { MapAppearance } from "../../../src/shared/geo/appearance/types"
import type { NightColors } from "../../../src/shared/geo/sun/time-tint"

const DIRECTORY = fileURLToPath(new URL("../../../src/shared/styles/tokens/", import.meta.url))
const DECLARATION = /(--[\w-]+)\s*:\s*([^;]+);/g
const MAX_DEPTH = 8

const declared = new Map<string, string>()
for (const name of readdirSync(DIRECTORY).filter((file) => file.endsWith(".css"))) {
  const root = readFileSync(`${DIRECTORY}${name}`, "utf8").split(/\[data-|@media/)[0] ?? ""
  for (const match of root.matchAll(DECLARATION)) {
    const [, key, value] = match
    if (key && value && !declared.has(key)) declared.set(key, value.trim())
  }
}

export function tokenValue(name: string): string | undefined {
  let value = declared.get(name)
  for (let depth = 0; value?.startsWith("var(") && depth < MAX_DEPTH; depth += 1)
    value = declared.get(value.slice(4, -1).trim())
  return value
}

export function tokenHex(name: string): string {
  const value = tokenValue(name)
  if (!value || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`${name} is not a colour`)
  return value
}

export function dayColors(id: MapAppearance): MapColors {
  return Object.fromEntries(
    Object.entries(APPEARANCES[id].palette).map(([key, token]) => [key, tokenHex(token)]),
  ) as MapColors
}

export function nightColors(id: MapAppearance): NightColors & {
  readonly label: string
  readonly labelStrong: string
  readonly labelHalo: string
} {
  const night: Readonly<Record<string, string>> = APPEARANCES[id].night?.palette ?? {}
  return Object.fromEntries(
    Object.entries(night).map(([key, token]) => [key, tokenHex(token)]),
  ) as unknown as ReturnType<typeof nightColors>
}

export function classTokens(id: MapAppearance): ReadonlyMap<string, string> {
  const prefix = APPEARANCES[id].classPrefix
  return new Map(
    [...declared.keys()]
      .filter((name) => name.startsWith(prefix))
      .map((name) => [name.slice(prefix.length).replaceAll("-", "_"), tokenHex(name)]),
  )
}

export const CATALOG_LAYERS: Readonly<Record<string, "ground" | "volume" | "prop" | "poi">> = {
  water: "ground",
  railway: "ground",
  hotel: "volume",
  bench: "prop",
  fountain: "prop",
  lamp: "prop",
  shelter: "prop",
  tree: "prop",
  tree_row: "prop",
  apartments: "volume",
  beach: "ground",
  building_work: "volume",
  cemetery: "ground",
  commercial: "ground",
  construction: "ground",
  factory: "volume",
  farmland: "ground",
  forest: "ground",
  garage: "volume",
  garden: "ground",
  grass: "ground",
  hospital: "volume",
  house: "volume",
  industrial: "ground",
  office: "volume",
  park: "ground",
  parking: "ground",
  pier: "ground",
  pitch: "ground",
  pool: "ground",
  residence: "volume",
  residential: "ground",
  retail: "volume",
  roof: "volume",
  school: "volume",
  scrub: "ground",
  shed: "volume",
  warehouse: "volume",
  wetland: "ground",
  wood: "ground",
  worship: "volume",
  default_ground: "ground",
  default_poi: "poi",
  default_prop: "prop",
  default_volume: "volume",
}

import { Building2, Footprints, Hotel, MapPin, Mountain, Sun, TreeDeciduous, Volume2, Waves, type LucideIcon } from "lucide-react"
import { useEffect } from "react"
import type { Direction, Highlight } from "../../city/city-scene"
import { orbit } from "../../city/camera-path"
import { COPY } from "../../deck/copy"
import parts from "../../deck/deck-parts.module.css"
import { SlideTitle } from "../../deck/slide-title"
import { useBeat } from "../../deck/use-beat"
import styles from "./layers-slide.module.css"

type LayerKey = keyof typeof COPY.layers.items

interface Layer {
  readonly key: LayerKey
  readonly icon: LucideIcon
  readonly direction: Direction
}

const STEP = 3800
const fixed = (hour: number) => ({ kind: "fixed", hour }) as const
const view = (
  center: readonly [number, number],
  distance: number,
  pitch: number,
  start: number,
  highlights: readonly Highlight[],
  hour = 15,
): Direction => ({
  path: { shots: orbit(center, 160, { distance, pitch, start, turn: 50 }, 5), seconds: 30, loop: true },
  clock: fixed(hour),
  highlights,
  shift: -0.25,
})

const LAYERS: readonly Layer[] = [
  { key: "buildings", icon: Building2, direction: view([150, 350], 900, 62, 200, ["grow"]) },
  { key: "relief", icon: Mountain, direction: view([300, 900], 2100, 72, 170, [], 8.5) },
  { key: "noise", icon: Volume2, direction: view([400, 300], 1500, 55, 150, ["noise"]) },
  { key: "trees", icon: TreeDeciduous, direction: view([-300, 700], 800, 60, 230, ["trees"]) },
  { key: "sea", icon: Waves, direction: view([-400, -300], 1500, 60, 240, ["coast"]) },
  { key: "walk", icon: Footprints, direction: view([0, 0], 420, 58, 190, ["walk", "route", "hero"]) },
  {
    key: "sun",
    icon: Sun,
    direction: { ...view([0, 80], 520, 64, 160, ["hero"]), clock: { kind: "sweep", from: 8, to: 19, seconds: 7 } },
  },
  { key: "places", icon: MapPin, direction: view([600, 500], 1700, 56, 140, ["noise"], 16) },
  { key: "hotels", icon: Hotel, direction: view([800, 200], 2600, 52, 130, ["hotels"], 17) },
]

export function LayersSlide({ direct }: { readonly direct: (direction: Direction) => void }) {
  const beat = useBeat(STEP, LAYERS.length, 400)
  const active = Math.max(0, beat - 1)
  useEffect(() => {
    const layer = LAYERS[active]
    if (layer) direct(layer.direction)
  }, [active, direct])
  return (
    <section className={parts.slide}>
      <div className={parts.scrim} />
      <SlideTitle title={COPY.layers.title} accent={COPY.layers.accent} />
      <ol className={styles.list}>
        {LAYERS.map((layer, index) => {
          const copy = COPY.layers.items[layer.key]
          const Icon = layer.icon
          const state = index === active ? "active" : index < active ? "done" : "next"
          return (
            <li key={layer.key} className={styles.item} data-state={state} style={{ animationDelay: `${0.25 + index * 0.06}s` }}>
              <span className={styles.icon}>
                <Icon aria-hidden="true" />
              </span>
              <span className={styles.text}>
                <span className={styles.name}>{copy.name}</span>
                <span className={styles.value}>{copy.value}</span>
              </span>
              <span className={styles.note}>{copy.note}</span>
              {index === active ? <span key={beat} className={styles.progress} /> : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

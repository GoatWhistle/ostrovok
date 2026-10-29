import { Building2, Footprints, Hotel, Sun, TreeDeciduous, Volume2, Waves, type LucideIcon } from "lucide-react"
import { useEffect, type CSSProperties } from "react"
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

const STEP = 2500
const fixed = (hour: number) => ({ kind: "fixed", hour }) as const
const view = (
  center: readonly [number, number],
  distance: number,
  pitch: number,
  start: number,
  highlights: readonly Highlight[],
  hour = 15,
): Direction => ({
  path: { shots: orbit(center, 40, { distance, pitch, start, turn: 20 }, 4), seconds: 40, loop: true },
  clock: fixed(hour),
  highlights,
  shift: -0.25,
})

const LAYERS: readonly Layer[] = [
  { key: "buildings", icon: Building2, direction: view([350, 450], 700, 58, 200, ["grow"]) },
  { key: "trees", icon: TreeDeciduous, direction: view([-100, 800], 650, 56, 230, ["trees"]) },
  { key: "noise", icon: Volume2, direction: view([400, 300], 1300, 55, 150, ["noise"]) },
  { key: "sea", icon: Waves, direction: view([-250, -150], 1500, 64, 240, ["coast"]) },
  { key: "walk", icon: Footprints, direction: view([0, 0], 520, 58, 190, ["walk", "route", "hero"], 8) },
  { key: "sun", icon: Sun, direction: view([0, 40], 480, 62, 190, ["hero"], 19) },
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
      <ol className={styles.list} style={{ "--step": `${STEP}ms` } as CSSProperties}>
        {LAYERS.map((layer, index) => {
          const copy = COPY.layers.items[layer.key]
          const Icon = layer.icon
          const state = index === active ? "active" : index < active ? "done" : "next"
          return (
            <li key={layer.key} className={styles.item} data-state={state} style={{ animationDelay: `${0.2 + index * 0.05}s` }}>
              <span className={styles.icon}>
                <Icon aria-hidden="true" />
              </span>
              <span className={styles.name}>{copy.name}</span>
              <span className={styles.value}>{copy.value}</span>
              {index === active ? <span key={beat} className={styles.progress} /> : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

import { clsx } from "clsx"
import { type ReactNode, useId, useState } from "react"
import { usePresence } from "../../../motion/use-presence"
import { Button, type ButtonSize } from "../../primitives/button/button"
import styles from "./map-attribution.module.css"

export interface MapAttributionProps {
  readonly label: string
  readonly osm: string
  readonly terrain: string
  readonly sources?: {
    readonly weather: string
    readonly landcover: string
    readonly biodiversity: string
    readonly events: string
    readonly license: string
  }
  readonly groups?: {
    readonly map: string
    readonly terrain: string
    readonly weather: string
    readonly other: string
  }
  readonly placement?: "above" | "below"
  readonly size?: ButtonSize
  readonly className?: string | undefined
}

interface Group {
  readonly id: string
  readonly title: string | undefined
  readonly items: readonly ReactNode[]
}

function sourceGroups({ osm, terrain, sources, groups }: MapAttributionProps): Group[] {
  const map = (
    <li key="osm">
      <a
        className={styles.link}
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
      >
        {osm}
      </a>
    </li>
  )
  const relief = (
    <li key="terrain">
      <a
        className={styles.link}
        href="https://mapterhorn.com/attribution/"
        target="_blank"
        rel="noreferrer"
      >
        {terrain}
      </a>
    </li>
  )
  if (!sources) return [{ id: "all", title: undefined, items: [map, relief] }]
  const rows: Group[] = [
    { id: "map", title: groups?.map, items: [map] },
    {
      id: "terrain",
      title: groups?.terrain,
      items: [
        relief,
        <li key="landcover">
          <a
            className={styles.link}
            href="https://esa-worldcover.org/en/data-access"
            target="_blank"
            rel="noreferrer"
          >
            {sources.landcover}
          </a>
        </li>,
      ],
    },
    {
      id: "weather",
      title: groups?.weather,
      items: [
        <li key="weather">
          <a
            className={styles.link}
            href="https://www.met.no/en/free-meteorological-data"
            target="_blank"
            rel="noreferrer"
          >
            {sources.weather}
          </a>
        </li>,
      ],
    },
    {
      id: "other",
      title: groups?.other,
      items: [
        <li key="biodiversity">
          <a
            className={styles.link}
            href="https://www.gbif.org/terms"
            target="_blank"
            rel="noreferrer"
          >
            {sources.biodiversity}
          </a>
        </li>,
        <li key="events">
          <a className={styles.link} href="https://kudago.com/" target="_blank" rel="noreferrer">
            {sources.events}
          </a>
        </li>,
      ],
    },
  ]
  return groups ? rows : [{ id: "all", title: undefined, items: rows.flatMap((row) => row.items) }]
}

export function MapAttribution(props: MapAttributionProps) {
  const { label, sources, className, placement = "above", size = "compact" } = props
  const id = useId()
  const [open, setOpen] = useState(false)
  const presence = usePresence(open)
  return (
    <div className={clsx(styles.root, className)} data-placement={placement}>
      {presence.mounted ? (
        <section
          id={id}
          aria-label={label}
          className={styles.panel}
          data-state={presence.state}
          onAnimationEnd={presence.onAnimationEnd}
        >
          <p className={styles.title}>{label}</p>
          {sourceGroups(props).map((group) => (
            <div key={group.id} className={styles.group}>
              {group.title ? <p className={styles.groupTitle}>{group.title}</p> : null}
              <ul className={styles.links}>{group.items}</ul>
            </div>
          ))}
          {sources ? (
            <a
              className={styles.license}
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noreferrer"
            >
              {sources.license}
            </a>
          ) : null}
        </section>
      ) : null}
      <Button
        variant="ghost"
        size={size}
        iconOnly
        icon="info"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((current) => !current)}
      >
        {label}
      </Button>
    </div>
  )
}

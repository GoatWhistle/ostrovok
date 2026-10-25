import { clsx } from "clsx"
import { useId, useState } from "react"
import { usePresence } from "../../../motion/use-presence"
import { Button } from "../../primitives/button/button"
import styles from "./map-attribution.module.css"

export interface MapAttributionProps {
  readonly label: string
  readonly osm: string
  readonly terrain: string
  readonly className?: string | undefined
}

export function MapAttribution({ label, osm, terrain, className }: MapAttributionProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const presence = usePresence(open)
  return (
    <div className={clsx(styles.root, className)}>
      {presence.mounted ? (
        <ul
          id={id}
          className={styles.links}
          data-state={presence.state}
          onAnimationEnd={presence.onAnimationEnd}
        >
          <li>
            <a
              className={styles.link}
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
            >
              {osm}
            </a>
          </li>
          <li>
            <a
              className={styles.link}
              href="https://mapterhorn.com/attribution/"
              target="_blank"
              rel="noreferrer"
            >
              {terrain}
            </a>
          </li>
        </ul>
      ) : null}
      <Button
        variant="ghost"
        size="compact"
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

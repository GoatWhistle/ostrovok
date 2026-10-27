import { clsx } from "clsx"
import { useId, useState } from "react"
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
  readonly placement?: "above" | "below"
  readonly size?: ButtonSize
  readonly className?: string | undefined
}

export function MapAttribution({
  label,
  osm,
  terrain,
  sources,
  className,
  placement = "above",
  size = "compact",
}: MapAttributionProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const presence = usePresence(open)
  return (
    <div className={clsx(styles.root, className)} data-placement={placement}>
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
          {sources ? (
            <>
              <li>
                <a
                  className={styles.link}
                  href="https://www.met.no/en/free-meteorological-data"
                  target="_blank"
                  rel="noreferrer"
                >
                  {sources.weather}
                </a>
              </li>
              <li>
                <a
                  className={styles.link}
                  href="https://esa-worldcover.org/en/data-access"
                  target="_blank"
                  rel="noreferrer"
                >
                  {sources.landcover}
                </a>
              </li>
              <li>
                <a
                  className={styles.link}
                  href="https://www.gbif.org/terms"
                  target="_blank"
                  rel="noreferrer"
                >
                  {sources.biodiversity}
                </a>
              </li>
              <li>
                <a
                  className={styles.link}
                  href="https://kudago.com/"
                  target="_blank"
                  rel="noreferrer"
                >
                  {sources.events}
                </a>
              </li>
              <li>
                <a
                  className={styles.link}
                  href="https://creativecommons.org/licenses/by/4.0/"
                  target="_blank"
                  rel="noreferrer"
                >
                  {sources.license}
                </a>
              </li>
            </>
          ) : null}
        </ul>
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

import type { CSSProperties } from "react"
import styles from "./start-rings.module.css"

const RINGS = Array.from({ length: 12 }, (_, step) => step)
const RIPPLES = [0, 1] as const

export function StartRings() {
  return (
    <svg
      className={styles.rings}
      viewBox="0 0 1000 1000"
      aria-hidden="true"
      focusable="false"
      fill="none"
    >
      {RINGS.map((step) => (
        <ellipse
          key={step}
          className={styles.ring}
          cx={500 + step * 5}
          cy={500 + step * 3}
          rx={44 + step * 38}
          ry={40 + step * 34}
          pathLength={1000}
          style={{ "--ring-step": step } as CSSProperties}
        />
      ))}
      {RIPPLES.map((step) => (
        <circle
          key={step}
          className={styles.ripple}
          cx={500}
          cy={500}
          r={480}
          style={{ "--ripple-step": step } as CSSProperties}
        />
      ))}
    </svg>
  )
}

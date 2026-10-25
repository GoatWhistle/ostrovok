import { useId } from "react"
import styles from "./lost-route.module.css"

const ROUTE = "M70 236 C 112 222, 146 206, 150 176 S 168 124, 232 114 S 328 100, 372 96"
const PIN = "M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"
const ASK = "M9.6 9.4a2.5 2.5 0 0 1 4.8 1c0 1.7-2.4 2.1-2.4 3.6"
const CONTOURS =
  "M-10 60 C 90 40, 200 70, 300 48 S 430 30, 490 44M-10 120 C 70 104, 170 128, 260 110 S 420 92, 490 104"
const PARK = "M262 150 C 300 140, 330 150, 338 176 S 312 214, 280 210 S 246 168, 262 150Z"
const MAJOR = "M-10 214 C 120 200, 300 222, 490 204"
const MINOR =
  "M152 -10 C 162 80, 140 150, 150 290M352 -10 C 344 90, 356 160, 340 280M-10 92 C 120 84, 300 104, 490 86"
const SEA = "M-10 282 C 110 262, 230 276, 330 266 S 450 252, 490 258 V370 H-10Z"
const SAND = "M-10 276 C 110 256, 230 270, 330 260 S 450 246, 490 252"
const COAST = "M-10 282 C 110 262, 230 276, 330 266 S 450 252, 490 258"
const BUILDINGS = [
  [22, 40, 44, 30],
  [82, 34, 34, 40],
  [24, 96, 52, 34],
  [186, 30, 50, 34],
  [250, 40, 40, 28],
  [392, 28, 56, 38],
  [186, 150, 40, 30],
  [400, 150, 46, 36],
  [88, 128, 30, 34],
] as const

export function LostRoute() {
  const mask = useId()
  return (
    <div className={styles.art}>
      <svg
        className={styles.svg}
        viewBox="0 0 480 360"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="480" height="360">
            <path className={styles.reveal} d={ROUTE} pathLength={1000} />
          </mask>
        </defs>
        <rect className={styles.land} width="480" height="360" />
        <path className={styles.contours} d={CONTOURS} />
        <path className={styles.park} d={PARK} />
        <g className={styles.buildings}>
          {BUILDINGS.map(([x, y, width, height]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width={width} height={height} rx="2" />
          ))}
        </g>
        <path className={styles.majorCasing} d={MAJOR} />
        <path className={styles.casing} d={MINOR} />
        <path className={styles.major} d={MAJOR} />
        <path className={styles.road} d={MINOR} />
        <path className={styles.sea} d={SEA} />
        <path className={styles.sand} d={SAND} />
        <path className={styles.coast} d={COAST} />
        <path className={styles.route} d={ROUTE} mask={`url(#${mask})`} />
        <circle className={styles.start} cx="70" cy="236" r="6" />
        <g transform="translate(372 96)">
          <g className={styles.pin}>
            <ellipse className={styles.shadow} cx="0" cy="0" rx="9" ry="3" />
            <g transform="scale(2.6) translate(-12 -21)">
              <path className={styles.pinBody} d={PIN} />
              <g transform="translate(12 10) scale(0.8) translate(-12 -12.6)">
                <path className={styles.ask} d={ASK} />
                <circle className={styles.dot} cx="12" cy="16.9" r="0.9" />
              </g>
            </g>
          </g>
        </g>
      </svg>
    </div>
  )
}

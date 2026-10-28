import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react"
import { useId, useRef, useState } from "react"
import { useTranslation } from "@/shared/i18n"
import styles from "./sun-arc.module.css"

const RADIUS = 46
const CENTER_X = 52
const CENTER_Y = 52
const HANDLE = 7

export interface SunArcProps {
  readonly hour: number
  readonly sunrise: number
  readonly sunset: number
  readonly label: string
  readonly clock: string
  readonly onHour: (hour: number) => void
  readonly onScrub?: (hour: number) => void
}

export function arcFraction(hour: number, sunrise: number, sunset: number): number {
  if (sunset <= sunrise) return 0.5
  return Math.min(1, Math.max(0, (hour - sunrise) / (sunset - sunrise)))
}

export function exactHour(fraction: number, sunrise: number, sunset: number): number {
  const span = Math.max(1, sunset - sunrise)
  return sunrise + Math.min(1, Math.max(0, fraction)) * span
}

export function hourFromFraction(fraction: number, sunrise: number, sunset: number): number {
  return Math.round(exactHour(fraction, sunrise, sunset))
}

export function fractionFromPoint(x: number, y: number, width: number): number {
  const scale = width / (CENTER_X * 2)
  const dx = x / scale - CENTER_X
  const dy = CENTER_Y - y / scale
  const angle = Math.atan2(Math.max(0, dy), dx)
  return Math.min(1, Math.max(0, 1 - angle / Math.PI))
}

function point(fraction: number) {
  const angle = Math.PI * (1 - fraction)
  return { x: CENTER_X + RADIUS * Math.cos(angle), y: CENTER_Y - RADIUS * Math.sin(angle) }
}

export function SunArc({ hour, sunrise, sunset, label, clock, onHour, onScrub }: SunArcProps) {
  const { t } = useTranslation()
  const id = useId()
  const [drag, setDrag] = useState<number | null>(null)
  const dragged = useRef<number | null>(null)
  const fraction = arcFraction(drag ?? hour, sunrise, sunset)
  const sun = point(fraction)
  const track = `M ${CENTER_X - RADIUS} ${CENTER_Y} A ${RADIUS} ${RADIUS} 0 0 1 ${CENTER_X + RADIUS} ${CENTER_Y}`
  const travelled = `M ${CENTER_X - RADIUS} ${CENTER_Y} A ${RADIUS} ${RADIUS} 0 0 1 ${sun.x} ${sun.y}`

  function move(event: ReactPointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    const next = exactHour(
      fractionFromPoint(event.clientX - box.left, event.clientY - box.top, box.width),
      sunrise,
      sunset,
    )
    if (!onScrub) {
      if (Math.round(next) !== hour) onHour(Math.round(next))
      return
    }
    if (next === dragged.current) return
    dragged.current = next
    setDrag(next)
    onScrub(next)
  }

  function release(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
    const last = dragged.current
    dragged.current = null
    setDrag(null)
    if (last !== null) onHour(Math.round(last))
  }

  function keys(event: ReactKeyboardEvent<HTMLDivElement>) {
    const step = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : -1
    if (event.key === "Home") return onHour(sunrise)
    if (event.key === "End") return onHour(sunset)
    if (!["ArrowRight", "ArrowUp", "ArrowLeft", "ArrowDown"].includes(event.key)) return
    event.preventDefault()
    onHour(Math.min(sunset, Math.max(sunrise, hour + step)))
  }

  return (
    <div className={styles.arc}>
      <div
        className={styles.canvas}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={sunrise}
        aria-valuemax={sunset}
        aria-valuenow={hour}
        aria-valuetext={clock}
        aria-describedby={id}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          move(event)
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) move(event)
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onKeyDown={keys}
      >
        <svg
          viewBox={`0 0 ${CENTER_X * 2} ${CENTER_Y + 10}`}
          className={styles.figure}
          aria-hidden="true"
        >
          <path d={track} className={styles.track} />
          <path d={travelled} className={styles.travelled} />
          <line
            x1={CENTER_X - RADIUS}
            y1={CENTER_Y}
            x2={CENTER_X + RADIUS}
            y2={CENTER_Y}
            className={styles.horizon}
          />
          <circle cx={sun.x} cy={sun.y} r={HANDLE} className={styles.sun} />
        </svg>
      </div>
      <p id={id} className={styles.ends}>
        <span>{t("explore:weather.sunriseShort")}</span>
        <span>{t("explore:weather.sunsetShort")}</span>
      </p>
    </div>
  )
}

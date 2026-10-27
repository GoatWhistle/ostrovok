import { Card } from "@/shared/ui"
import { span } from "../playback/story-frame"
import type { CoverTiming } from "../playback/timing"
import styles from "./typed-request.module.css"

interface TypedRequestProps {
  readonly text: string
  readonly label: string
  readonly time: number
  readonly duration: number
  readonly timing: CoverTiming
}

export function TypedRequest({ text, label, time, duration, timing }: TypedRequestProps) {
  const progress = span(time, timing.typeDelay, timing.typeDelay + duration)
  const characters = Array.from(text)
  const count = Math.floor(characters.length * progress)
  const caret = progress < 1 && Math.floor(time / timing.caret) % 2 === 0
  return (
    <Card as="div" className={styles.request}>
      <span className={styles.label}>{label}</span>
      <span className="visually-hidden">{text}</span>
      <span className={styles.text} aria-hidden="true">
        <span className={styles.measure}>{text}</span>
        <span className={styles.typed}>
          {characters.slice(0, count).join("")}
          <span className={styles.caret} style={{ opacity: caret ? 1 : 0 }} />
        </span>
      </span>
    </Card>
  )
}

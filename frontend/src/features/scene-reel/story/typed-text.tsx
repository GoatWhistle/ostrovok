import { clsx } from "clsx"
import styles from "./typed-text.module.css"

interface TypedTextProps {
  readonly text: string
  readonly progress: number
  readonly caret: boolean
  readonly className?: string | undefined
}

export function TypedText({ text, progress, caret, className }: TypedTextProps) {
  const characters = Array.from(text)
  const typed = characters.slice(0, Math.ceil(characters.length * progress)).join("")
  const blink = caret && progress > 0 && progress < 1
  return (
    <span className={clsx(styles.text, className)} aria-hidden="true">
      <span className={styles.measure}>{text}</span>
      <span className={styles.typed}>
        {typed}
        <span className={styles.caret} style={{ opacity: blink ? 1 : 0 }} />
      </span>
    </span>
  )
}

import type { RefObject } from "react"
import type { ProofKind } from "../shots"
import styles from "./proof-label.module.css"
import { TypedText } from "./typed-text"

interface ProofLabelProps {
  readonly anchor: RefObject<HTMLDivElement | null>
  readonly kind: ProofKind
  readonly text: string
  readonly progress: number
  readonly caret: boolean
}

export function ProofLabel({ anchor, kind, text, progress, caret }: ProofLabelProps) {
  return (
    <div ref={anchor} className={styles.anchor} data-kind={kind} aria-hidden="true">
      <span className={styles.ping} data-part="ping" />
      <span className={styles.dot} />
      <span className={styles.label} data-part="text">
        <TypedText text={text} progress={progress} caret={caret} />
      </span>
    </div>
  )
}

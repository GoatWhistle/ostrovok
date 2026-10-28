import type { RefObject } from "react"
import type { ProofKind } from "../shots"
import styles from "./proof-label.module.css"

interface ProofLabelProps {
  readonly anchor: RefObject<HTMLDivElement | null>
  readonly kind: ProofKind
  readonly text: string
}

export function ProofLabel({ anchor, kind, text }: ProofLabelProps) {
  return (
    <div ref={anchor} className={styles.anchor} data-kind={kind} aria-hidden="true">
      <span className={styles.ping} data-part="ping" />
      <span className={styles.dot} />
      <span className={styles.stem} data-part="text">
        <span className={styles.label}>
          <span className={styles.swatch} />
          {text}
        </span>
      </span>
    </div>
  )
}

import { type ReactNode, useId } from "react"
import styles from "./details-section.module.css"

export interface DetailsSectionProps {
  readonly title: string
  readonly hint?: string | undefined
  readonly children: ReactNode
}

export function DetailsSection({ title, hint, children }: DetailsSectionProps) {
  const headingId = useId()
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <div className={styles.head}>
        <p id={headingId} className={styles.heading}>
          {title}
        </p>
        {hint === undefined ? null : <p className={styles.hint}>{hint}</p>}
      </div>
      {children}
    </section>
  )
}

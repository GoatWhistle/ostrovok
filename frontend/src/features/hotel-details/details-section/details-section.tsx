import { clsx } from "clsx"
import { type ReactNode, useId } from "react"
import { Disclosure } from "@/shared/ui"
import styles from "./details-section.module.css"

export interface DetailsSectionProps {
  readonly title: string
  readonly hint?: string | undefined
  readonly collapsible?: boolean
  readonly children: ReactNode
}

export function DetailsSection({
  title,
  hint,
  children,
  collapsible = false,
}: DetailsSectionProps) {
  const headingId = useId()
  const note = hint === undefined ? null : <p className={styles.hint}>{hint}</p>
  return (
    <section
      className={clsx(styles.section, collapsible && styles.collapsible)}
      aria-labelledby={collapsible ? undefined : headingId}
      aria-label={collapsible ? title : undefined}
    >
      {collapsible ? (
        <Disclosure title={title}>
          {note}
          {children}
        </Disclosure>
      ) : (
        <>
          <div className={styles.head}>
            <p id={headingId} className={styles.heading}>
              {title}
            </p>
            {note}
          </div>
          {children}
        </>
      )}
    </section>
  )
}

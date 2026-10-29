import styles from "./deck-parts.module.css"

export function SlideTitle({
  title,
  accent,
  lead,
}: {
  readonly title: string
  readonly accent: string
  readonly lead?: string
}) {
  return (
    <header className={styles.heading}>
      <h2 className={styles.title}>
        {title} <em className={styles.accent}>{accent}</em>
      </h2>
      {lead ? <p className={styles.lead}>{lead}</p> : null}
    </header>
  )
}

import styles from "./supplier.module.css"

export function Highlighted({
  text,
  pattern,
}: {
  readonly text: string
  readonly pattern: RegExp | undefined
}) {
  if (!pattern) return text
  const global = new RegExp(pattern.source, "giu")
  let offset = 0
  return text.split(global).map((part, index) => {
    const at = offset
    offset += part.length
    return index % 2 ? (
      <mark key={`mark:${at}`} className={styles.mark}>
        {part}
      </mark>
    ) : (
      <span key={`text:${at}`}>{part}</span>
    )
  })
}

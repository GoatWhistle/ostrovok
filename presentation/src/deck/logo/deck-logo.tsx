import styles from "./deck-logo.module.css"

const LEFT = "M5 14 22 8v42L5 56Z"
const MIDDLE = "M25 8l14 6v42l-14-6Z"
const RIGHT = "M42 14 59 8v42l-17 6Z"
const NAME = "factmap"

export function DeckLogo({ size }: { readonly size: "hero" | "corner" | "final" }) {
  return (
    <div className={styles.logo} data-size={size}>
      <svg className={styles.mark} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <path className={styles.left} d={LEFT} />
        <path className={styles.middle} d={MIDDLE} />
        <path className={styles.right} d={RIGHT} />
      </svg>
      <span className={styles.word} aria-label={NAME}>
        {[...NAME].map((letter, index) => (
          <span key={`${letter}-${index}`} className={styles.letter} data-letter={index} aria-hidden="true">
            {letter}
          </span>
        ))}
      </span>
    </div>
  )
}

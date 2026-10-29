import { COPY } from "../../deck/copy"
import { DeckLogo } from "../../deck/logo/deck-logo"
import styles from "./cover-slide.module.css"

export function CoverSlide() {
  return (
    <section className={styles.slide}>
      <div className={styles.plate}>
        <DeckLogo size="hero" />
        <span className={styles.rule} />
        <p className={styles.team}>{COPY.cover.team}</p>
      </div>
    </section>
  )
}

import { COPY } from "../../deck/copy"
import parts from "../../deck/deck-parts.module.css"
import { SlideTitle } from "../../deck/slide-title"
import { useBeat, useTyped } from "../../deck/use-beat"
import styles from "./problem-slide.module.css"

const QUERIES = Object.values(COPY.problem.queries)

function Bubble({ text, latest }: { readonly text: string; readonly latest: boolean }) {
  const typed = useTyped(text, latest, 18)
  const shown = latest ? typed : text
  const typing = latest && typed.length < text.length
  return (
    <div className={styles.bubble} data-typing={typing}>
      <span className={styles.text}>
        {shown}
        {typing ? <span className={styles.caret} /> : null}
      </span>
    </div>
  )
}

export function ProblemSlide() {
  const beat = useBeat(1100, QUERIES.length, 700)
  return (
    <section className={parts.slide}>
      <div className={parts.scrim} />
      <SlideTitle
        title={COPY.problem.title}
        accent={COPY.problem.accent}
        lead={COPY.problem.lead}
      />
      <div className={styles.feed}>
        {QUERIES.slice(0, beat).map((text, index) => (
          <Bubble key={text} text={text} latest={index === beat - 1} />
        ))}
      </div>
    </section>
  )
}

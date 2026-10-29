import type { CSSProperties } from "react"
import { COPY } from "../../deck/copy"
import parts from "../../deck/deck-parts.module.css"
import { SlideTitle } from "../../deck/slide-title"
import { useBeat, useTyped } from "../../deck/use-beat"
import styles from "./problem-slide.module.css"

const QUERIES = Object.values(COPY.problem.queries)
const VISIBLE = 4

function Bubble({ text, age }: { readonly text: string; readonly age: number }) {
  const typed = useTyped(text, true, 34)
  const typing = typed.length < text.length
  return (
    <div
      className={styles.bubble}
      data-age={age}
      style={{ "--age": age } as CSSProperties}
    >
      <div className={styles.card}>
        <span className={styles.text}>
          {typed}
          {typing ? <span className={styles.caret} /> : null}
        </span>
      </div>
    </div>
  )
}

export function ProblemSlide() {
  const beat = useBeat(2600, QUERIES.length, 700)
  const shown = QUERIES.slice(0, beat)
    .map((text, index) => ({ text, index }))
    .slice(-VISIBLE)
  return (
    <section className={parts.slide}>
      <div className={parts.scrim} />
      <SlideTitle
        title={COPY.problem.title}
        accent={COPY.problem.accent}
        lead={COPY.problem.lead}
      />
      <div className={styles.feed}>
        {shown.map(({ text, index }) => (
          <Bubble key={index} text={text} age={beat - 1 - index} />
        ))}
      </div>
    </section>
  )
}

import { CircleCheck, MapPin, Ruler, Star, type LucideIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { COPY } from "../../deck/copy"
import parts from "../../deck/deck-parts.module.css"
import { SlideTitle } from "../../deck/slide-title"
import styles from "./facts-slide.module.css"

export type FactKey = "sea" | "quiet" | "height"

type Fact = {
  readonly key: FactKey
  readonly title: string
  readonly note: string
  readonly icon: LucideIcon
  readonly tone: "success" | "measure"
}

const FACTS: readonly Fact[] = [
  { key: "sea", title: COPY.facts.sea, note: COPY.facts.seaNote, icon: CircleCheck, tone: "success" },
  { key: "quiet", title: COPY.facts.quiet, note: COPY.facts.quietNote, icon: CircleCheck, tone: "success" },
  { key: "height", title: COPY.facts.height, note: COPY.facts.heightNote, icon: Ruler, tone: "measure" },
]

const REVEAL_MS = 1500
const CYCLE_MS = 4000
const STARS = 4

export function FactsSlide({ onFocus }: { readonly onFocus: (fact: FactKey | null) => void }) {
  const [active, setActive] = useState<number | null>(null)
  const [hovered, setHovered] = useState(false)
  const focusRef = useRef(onFocus)
  focusRef.current = onFocus

  useEffect(() => {
    const timer = window.setTimeout(() => setActive((value) => value ?? 0), REVEAL_MS)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (hovered || active === null) return
    const timer = window.setInterval(() => {
      setActive((value) => ((value ?? -1) + 1) % FACTS.length)
    }, CYCLE_MS)
    return () => window.clearInterval(timer)
  }, [hovered, active])

  useEffect(() => {
    if (active === null) return
    const fact = FACTS[active]
    if (fact) focusRef.current(fact.key)
  }, [active])

  useEffect(() => () => focusRef.current(null), [])

  return (
    <section className={parts.slide}>
      <div className={parts.scrim} />
      <SlideTitle title={COPY.facts.title} accent={COPY.facts.accent} />
      <article className={`${parts.plate} ${styles.panel}`}>
        <header className={styles.head}>
          <div className={styles.nameRow}>
            <h3 className={styles.name}>El Paraiso</h3>
            <span className={styles.stars} aria-label={`${STARS}`}>
              {Array.from({ length: STARS }, (_, index) => (
                <Star key={index} size={20} strokeWidth={0} fill="currentColor" />
              ))}
            </span>
          </div>
          <p className={styles.address}>
            <MapPin size={18} strokeWidth={2.2} />
            {COPY.facts.address}
          </p>
        </header>
        <h4 className={styles.section}>{COPY.facts.query}</h4>
        <ul className={styles.list}>
          {FACTS.map((fact, index) => {
            const Icon = fact.icon
            const isActive = index === active
            return (
              <li
                key={fact.key}
                className={styles.row}
                data-active={isActive || undefined}
                data-tone={fact.tone}
                style={{ animationDelay: `${0.5 + index * 0.22}s` }}
                onMouseEnter={() => {
                  setHovered(true)
                  setActive(index)
                }}
                onMouseLeave={() => setHovered(false)}
              >
                <span className={styles.marker} />
                <span className={styles.icon}>
                  <Icon size={26} strokeWidth={2.2} />
                </span>
                <span className={styles.text}>
                  <span className={styles.factTitle}>{fact.title}</span>
                  <span className={styles.note}>{fact.note}</span>
                </span>
                <span className={styles.map}>
                  <MapPin size={16} strokeWidth={2.4} />
                  {COPY.facts.map}
                </span>
              </li>
            )
          })}
        </ul>
      </article>
    </section>
  )
}

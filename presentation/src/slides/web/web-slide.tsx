import { CircleCheck, CircleSlash, FileText, Globe, Quote } from "lucide-react"
import { AgentCard, ChatWindow, Chip, UserBubble } from "../../deck/chat-ui"
import { COPY } from "../../deck/copy"
import parts from "../../deck/deck-parts.module.css"
import { SlideTitle } from "../../deck/slide-title"
import { useTimeline } from "../../deck/use-beat"
import styles from "./web-slide.module.css"

const copy = COPY.web
const MARKS = [400, 1200, 2000, 2800, 3700, 4600, 5400] as const
const STEPS = [
  { icon: CircleSlash, text: copy.steps.facts, kind: "miss" },
  { icon: CircleSlash, text: copy.steps.vectors, kind: "miss" },
  { icon: Globe, text: copy.steps.search, kind: "work" },
  { icon: FileText, text: copy.steps.read, kind: "work" },
  { icon: Quote, text: copy.steps.quote, kind: "hit" },
] as const

export function WebSlide() {
  const step = useTimeline(MARKS)
  const shown = Math.max(0, Math.min(STEPS.length, step - 1))
  const done = step >= 7
  return (
    <section className={parts.slide}>
      <SlideTitle title={copy.title} accent={copy.accent} lead={copy.stat} />
      <ol className={styles.steps}>
        {STEPS.slice(0, shown).map(({ icon: Icon, text, kind }, index) => (
          <li key={text} className={styles.step} data-kind={kind}>
            <span className={styles.node}>
              <Icon aria-hidden="true" className={styles.icon} />
            </span>
            <span className={styles.text}>{text}</span>
            {index === shown - 1 && !done && kind !== "hit" ? <span className={styles.spinner} /> : null}
          </li>
        ))}
      </ol>
      <ChatWindow title={copy.header} className={styles.window}>
        {step >= 1 ? <UserBubble time="07:52">{copy.wish}</UserBubble> : null}
        {done ? (
          <AgentCard>
            <p className={styles.reply}>{copy.reply}</p>
            <div className={styles.result}>
              <CircleCheck aria-hidden="true" className={styles.check} />
              <span className={styles.name}>{copy.result}</span>
              <Chip>{copy.quoteRule}</Chip>
            </div>
            <span className={styles.source}>{copy.source}</span>
          </AgentCard>
        ) : null}
      </ChatWindow>
    </section>
  )
}

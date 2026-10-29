import { CircleCheck, CircleSlash, FileText, Globe, Quote } from "lucide-react"
import { AgentCard, ChatWindow, Chip, UserBubble } from "../../deck/chat-ui"
import { COPY } from "../../deck/copy"
import parts from "../../deck/deck-parts.module.css"
import { SlideTitle } from "../../deck/slide-title"
import { useTimeline } from "../../deck/use-beat"
import styles from "./web-slide.module.css"

const copy = COPY.web
const MARKS = [400, 1100, 1800, 2600, 3500, 4400, 5200] as const
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
  return (
    <section className={parts.slide}>
      <SlideTitle title={copy.title} accent={copy.accent} lead={copy.stat} />
      <div className={styles.stage}>
        <ChatWindow title={copy.header}>
          {step >= 1 ? <UserBubble time="07:52">{copy.wish}</UserBubble> : null}
          {step >= 2 ? (
            <AgentCard>
              <ol className={styles.steps}>
                {STEPS.slice(0, shown).map(({ icon: Icon, text, kind }, index) => (
                  <li key={text} className={styles.step} data-kind={kind}>
                    <Icon aria-hidden="true" className={styles.icon} />
                    <span>{text}</span>
                    {index === shown - 1 && step < 7 && kind !== "hit" ? <span className={styles.spinner} /> : null}
                  </li>
                ))}
              </ol>
              {step >= 7 ? (
                <div className={styles.answer}>
                  <p className={styles.reply}>{copy.reply}</p>
                  <div className={styles.result}>
                    <CircleCheck aria-hidden="true" className={styles.check} />
                    <span className={styles.name}>{copy.result}</span>
                    <Chip>{copy.quoteRule}</Chip>
                  </div>
                  <span className={styles.source}>{copy.source}</span>
                </div>
              ) : null}
            </AgentCard>
          ) : null}
        </ChatWindow>
      </div>
    </section>
  )
}

import { Footprints, List, Map as MapIcon, MapPin, Volume1 } from "lucide-react"
import { AgentCard, ChatWindow, Chip, Composer, chatStyles, UserBubble } from "../../deck/chat-ui"
import { COPY } from "../../deck/copy"
import parts from "../../deck/deck-parts.module.css"
import { SlideTitle } from "../../deck/slide-title"
import { useTimeline, useTyped } from "../../deck/use-beat"
import styles from "./chat-slide.module.css"

const MARKS = [500, 1900, 2300, 3300, 3700, 4100, 4600, 5300, 5900] as const
const copy = COPY.chat
const WORDS = [copy.place.word, copy.quiet.word, copy.sea.word] as const
const CHIPS = [copy.place.rule, copy.quiet.word, copy.sea.word] as const
const FILTERS = [
  { icon: MapPin, name: copy.place.name, rule: copy.place.rule },
  { icon: Volume1, name: copy.quiet.name, rule: copy.quiet.rule },
  { icon: Footprints, name: copy.sea.name, rule: copy.sea.rule },
] as const

function Highlighted({ text, marked }: { readonly text: string; readonly marked: number }) {
  const parts: { text: string; mark: boolean }[] = []
  let rest = text
  while (rest.length) {
    const hits = WORDS.slice(0, marked)
      .map((word) => ({ word, at: rest.indexOf(word) }))
      .filter((hit) => hit.at >= 0)
      .sort((a, b) => a.at - b.at)
    const hit = hits[0]
    if (!hit) {
      parts.push({ text: rest, mark: false })
      break
    }
    if (hit.at > 0) parts.push({ text: rest.slice(0, hit.at), mark: false })
    parts.push({ text: hit.word, mark: true })
    rest = rest.slice(hit.at + hit.word.length)
  }
  return parts.map((part, index) =>
    part.mark ? (
      <mark key={`${part.text}-${index}`} className={styles.mark}>
        {part.text}
      </mark>
    ) : (
      <span key={`${part.text}-${index}`}>{part.text}</span>
    ),
  )
}

export function ChatSlide() {
  const step = useTimeline(MARKS)
  const typed = useTyped(copy.query, step >= 1, 40)
  const sent = step >= 2
  const chips = Math.max(0, Math.min(3, step - 3))
  return (
    <section className={parts.slide}>
      <SlideTitle title={copy.title} accent={copy.accent} />
      <div className={styles.stage}>
        <ChatWindow title={sent ? "Адлер: тихий, у моря" : ""}>
          {sent ? (
            <UserBubble time={copy.time}>
              <Highlighted text={copy.query} marked={chips} />
            </UserBubble>
          ) : null}
          {step >= 3 && step < 4 ? (
            <div className={styles.thinking}>
              <span className={styles.spinner} />
              {copy.thinking}
            </div>
          ) : null}
          {step >= 4 ? (
            <AgentCard>
              <span className={styles.label}>{copy.understood}</span>
              <div className={styles.chips}>
                {CHIPS.slice(0, chips).map((chip) => (
                  <Chip key={chip}>{chip}</Chip>
                ))}
              </div>
              {step >= 7 ? (
                <div className={styles.filters}>
                  <span className={styles.label}>{copy.filters}</span>
                  {FILTERS.map(({ icon: Icon, name, rule }, index) => (
                    <div key={name} className={styles.filter} style={{ animationDelay: `${index * 0.12}s` }}>
                      <Icon aria-hidden="true" className={styles.filterIcon} />
                      <span className={styles.filterName}>{name}</span>
                      <span className={styles.filterRule}>{rule}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              {step >= 8 ? <p className={styles.reply}>{copy.reply}</p> : null}
              {step >= 9 ? (
                <div className={styles.actions}>
                  <span className={styles.primary}>
                    <MapIcon aria-hidden="true" />
                    {copy.map}
                  </span>
                  <span className={styles.secondary}>
                    <List aria-hidden="true" />
                    {copy.list}
                  </span>
                </div>
              ) : null}
            </AgentCard>
          ) : null}
          <div className={chatStyles.composerSlot}>
            <Composer text={sent ? "" : typed} placeholder={copy.composer} />
          </div>
        </ChatWindow>
      </div>
    </section>
  )
}

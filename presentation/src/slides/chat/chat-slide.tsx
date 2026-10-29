import { ArrowRight, List, Map as MapIcon } from "lucide-react"
import { AgentCard, ChatWindow, Chip, Composer, chatStyles, UserBubble } from "../../deck/chat-ui"
import { COPY } from "../../deck/copy"
import parts from "../../deck/deck-parts.module.css"
import { SlideTitle } from "../../deck/slide-title"
import { useTimeline, useTyped } from "../../deck/use-beat"
import styles from "./chat-slide.module.css"

const MARKS = [500, 1900, 2300, 3300, 3700, 4300, 4900, 5600, 6200] as const
const copy = COPY.chat
const RULES = [copy.quiet, copy.sea, copy.place] as const
const WORDS = RULES.map((rule) => rule.word)
const CHIPS = [copy.quiet.word, copy.sea.word, copy.place.rule] as const

function Highlighted({ text, marked }: { readonly text: string; readonly marked: number }) {
  const pieces: { text: string; mark: boolean }[] = []
  let rest = text
  while (rest.length) {
    const hits = WORDS.slice(0, marked)
      .map((word) => ({ word, at: rest.indexOf(word) }))
      .filter((hit) => hit.at >= 0)
      .sort((a, b) => a.at - b.at)
    const hit = hits[0]
    if (!hit) {
      pieces.push({ text: rest, mark: false })
      break
    }
    if (hit.at > 0) pieces.push({ text: rest.slice(0, hit.at), mark: false })
    pieces.push({ text: hit.word, mark: true })
    rest = rest.slice(hit.at + hit.word.length)
  }
  return pieces.map((piece, index) =>
    piece.mark ? (
      <mark key={`${piece.text}-${index}`} className={styles.mark}>
        {piece.text}
      </mark>
    ) : (
      <span key={`${piece.text}-${index}`}>{piece.text}</span>
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
      <ol className={styles.rules}>
        {RULES.slice(0, chips).map(({ word, name, rule }) => (
          <li key={word} className={styles.rule}>
            <span className={styles.word}>{word}</span>
            <ArrowRight aria-hidden="true" className={styles.arrow} />
            <span className={styles.filter}>
              <span className={styles.filterName}>{name}</span>
              <span className={styles.filterRule}>{rule}</span>
            </span>
          </li>
        ))}
      </ol>
      <ChatWindow title="Адлер: тихий, у моря" className={styles.window}>
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
            {step >= 7 ? <p className={styles.reply}>{copy.reply}</p> : null}
            {step >= 8 ? (
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
    </section>
  )
}

import { useId } from "react"
import { useTranslation } from "@/shared/i18n"
import { useFirstVisit } from "@/shared/motion"
import { BrandMark, Chip, characteristicHue, characteristicIcon } from "@/shared/ui"
import { ChatComposer } from "./chat-composer"
import { SUGGESTIONS } from "./chat-greeting"
import styles from "./chat-start.module.css"
import { StartRings } from "./start-rings"
import { useTypedExample } from "./use-typed-example"

export interface ChatStartProps {
  readonly pending: boolean
  readonly onSend: (message: string) => void
}

export function ChatStart({ pending, onSend }: ChatStartProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const firstVisit = useFirstVisit("factmap-start")
  const examples = [
    t("explore:chat.example1"),
    t("explore:chat.example2"),
    t("explore:chat.example3"),
  ]
  const placeholder = useTypedExample(examples, pending)
  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <div className={styles.lockup}>
        <span className={styles.mark}>
          <StartRings />
          <BrandMark size="lg" motion={firstVisit ? "enter" : "still"} />
        </span>
        <span className={styles.word}>{t("common:app.wordmark")}</span>
      </div>
      <h1 id={titleId} className={styles.title}>
        {t("explore:chat.startTitle")}
      </h1>
      <p className={styles.text}>{t("explore:chat.startText")}</p>
      <div className={styles.composer}>
        <ChatComposer pending={pending} placeholder={placeholder} onSend={onSend} />
      </div>
      <div className={styles.chips}>
        {SUGGESTIONS.map((item) => (
          <Chip
            key={item.key}
            icon={characteristicIcon(item.key)}
            hue={characteristicHue(item.key)}
            label={t(item.label)}
            onClick={() => onSend(t(item.label))}
          />
        ))}
      </div>
    </section>
  )
}

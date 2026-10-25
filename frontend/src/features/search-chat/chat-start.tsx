import { useId } from "react"
import { useTranslation } from "@/shared/i18n"
import { useFirstVisit } from "@/shared/motion"
import { BrandMark, Chip, characteristicHue, characteristicIcon } from "@/shared/ui"
import { ChatComposer } from "./chat-composer"
import { SUGGESTIONS } from "./chat-greeting"
import styles from "./chat-start.module.css"

export interface ChatStartProps {
  readonly pending: boolean
  readonly onSend: (message: string) => void
}

export function ChatStart({ pending, onSend }: ChatStartProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const firstVisit = useFirstVisit("factmap-start")
  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <BrandMark size="lg" motion={firstVisit ? "enter" : "still"} />
      <h1 id={titleId} className={styles.title}>
        {t("explore:chat.startTitle")}
      </h1>
      <p className={styles.text}>{t("explore:chat.startText")}</p>
      <div className={styles.composer}>
        <ChatComposer pending={pending} onSend={onSend} />
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

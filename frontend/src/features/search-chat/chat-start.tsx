import { useId, useRef, useState } from "react"
import { type MessageKey, useTranslation } from "@/shared/i18n"
import { motionMs, useFirstVisit } from "@/shared/motion"
import { BrandMark, Button, Chip, characteristicHue, characteristicIcon } from "@/shared/ui"
import { ChatComposer } from "./chat-composer"
import styles from "./chat-start.module.css"
import { useTypedExample } from "./use-typed-example"

const UNFOLD_COOLDOWN = 2
const RECENT_LIMIT = 3

const START_SUGGESTIONS: readonly { readonly key: string; readonly label: MessageKey }[] = [
  { key: "sunset_view", label: "explore:chat.suggestSunset" },
  { key: "distance_to_sea", label: "explore:chat.suggestWalk" },
  { key: "noise_level", label: "explore:chat.suggestQuiet" },
  { key: "pets_policy", label: "explore:chat.suggestPets" },
  { key: "bars_nearby", label: "explore:chat.suggestBars" },
  { key: "building_height", label: "explore:chat.suggestHigh" },
]

export interface ChatStartProps {
  readonly pending: boolean
  readonly recent: readonly { readonly id: string; readonly title: string }[]
  readonly onSend: (message: string) => void
  readonly onOpen: (id: string) => void
  readonly onHistory: () => void
}

export function ChatStart({ pending, recent, onSend, onOpen, onHistory }: ChatStartProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const firstVisit = useFirstVisit("factmap-start")
  const [unfold, setUnfold] = useState(0)
  const unfoldedAt = useRef(0)
  const replay = () => {
    const now = performance.now()
    if (now - unfoldedAt.current < motionMs("--dur-fold") * UNFOLD_COOLDOWN) return
    unfoldedAt.current = now
    setUnfold((count) => count + 1)
  }
  const typed = useTypedExample(
    [t("explore:chat.example1"), t("explore:chat.example2"), t("explore:chat.example3")],
    pending,
  )
  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <div className={styles.lockup} onPointerEnter={replay}>
        <BrandMark key={unfold} size="lg" motion={firstVisit || unfold > 0 ? "enter" : "still"} />
        <span className={styles.word}>{t("common:app.wordmark")}</span>
      </div>
      <h1 id={titleId} className={styles.title}>
        {t("explore:chat.startTitle")}
      </h1>
      <p className={styles.text}>{t("explore:chat.startText")}</p>
      <div className={styles.composer}>
        <ChatComposer pending={pending} placeholder={typed.text} onSend={onSend} />
      </div>
      <div className={styles.chips}>
        {START_SUGGESTIONS.map((item) => (
          <Chip
            key={item.key}
            icon={characteristicIcon(item.key)}
            hue={characteristicHue(item.key)}
            label={t(item.label)}
            size="large"
            onClick={() => onSend(t(item.label))}
          />
        ))}
      </div>
      {recent.length ? (
        <section className={styles.recent} aria-label={t("explore:chat.recent")}>
          <div className={styles.recentHead}>
            <p className={styles.recentTitle}>{t("explore:chat.recent")}</p>
            <Button variant="ghost" size="compact" onClick={onHistory}>
              {t("explore:chat.allHistory")}
            </Button>
          </div>
          <ul className={styles.recentList}>
            {recent.slice(0, RECENT_LIMIT).map((item) => (
              <li key={item.id}>
                <Button
                  variant="ghost"
                  size="compact"
                  align="start"
                  icon="history"
                  className={styles.recentItem}
                  onClick={() => onOpen(item.id)}
                >
                  <span className={styles.recentLabel}>
                    {item.title || t("explore:chat.untitled")}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  )
}

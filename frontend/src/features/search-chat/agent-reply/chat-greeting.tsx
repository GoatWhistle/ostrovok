import { type MessageKey, useTranslation } from "@/shared/i18n"
import { useFirstVisit } from "@/shared/motion"
import { Chip, characteristicHue, characteristicIcon } from "@/shared/ui"
import { AgentBubble } from "../chat-bubble/chat-bubble"
import styles from "./agent-reply.module.css"

export const SUGGESTIONS: readonly { readonly key: string; readonly label: MessageKey }[] = [
  { key: "sunset_view", label: "explore:chat.suggestSunset" },
  { key: "distance_to_sea", label: "explore:chat.suggestWalk" },
  { key: "pets_policy", label: "explore:chat.suggestPets" },
  { key: "noise_level", label: "explore:chat.suggestQuiet" },
]

export function ChatGreeting({ onSend }: { readonly onSend: (query: string) => void }) {
  const { t } = useTranslation()
  const firstVisit = useFirstVisit("factmap-greeting")
  return (
    <AgentBubble motion={firstVisit ? "enter" : "still"}>
      <p className={styles.lead}>{t("explore:chat.greeting")}</p>
      <div className={styles.group}>
        <p className={styles.caption}>{t("explore:chat.suggestions")}</p>
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
      </div>
    </AgentBubble>
  )
}

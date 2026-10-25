import { useId } from "react"
import { useRegions } from "@/entities/catalog"
import { useTranslation } from "@/shared/i18n"
import { useFirstVisit } from "@/shared/motion"
import { BrandMark, Chip, characteristicHue, characteristicIcon, StatusBadge } from "@/shared/ui"
import { ChatComposer } from "./chat-composer"
import { SUGGESTIONS } from "./chat-greeting"
import styles from "./chat-start.module.css"
import { useTypedExample } from "./use-typed-example"

export interface ChatStartProps {
  readonly pending: boolean
  readonly onSend: (message: string) => void
}

export function ChatStart({ pending, onSend }: ChatStartProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const firstVisit = useFirstVisit("factmap-start")
  const regions = useRegions()
  const examples = [
    t("explore:chat.example1"),
    t("explore:chat.example2"),
    t("explore:chat.example3"),
  ]
  const placeholder = useTypedExample(examples, pending)
  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <BrandMark size="lg" motion={firstVisit ? "enter" : "still"} />
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
      {regions.data?.items?.length ? (
        <ul className={styles.stats}>
          {regions.data.items.map((region) => (
            <li key={region.id}>
              <StatusBadge tone="neutral" icon="building">
                {t("explore:chat.regionHotels", {
                  region: region.name,
                  count: region.hotels_count ?? 0,
                })}
              </StatusBadge>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

import type { ReactNode } from "react"
import { useTranslation } from "@/shared/i18n"
import { BrandMark, type BrandMarkMotion } from "@/shared/ui"
import styles from "./chat-bubble.module.css"

export function UserBubble({
  children,
  time,
}: {
  readonly children: ReactNode
  readonly time?: string | undefined
}) {
  const { t } = useTranslation()
  return (
    <li className={styles.user}>
      <span className="visually-hidden">{t("explore:chat.you")}</span>
      <p className={styles.userText}>
        {children}
        {time ? <span className={styles.time}>{time}</span> : null}
      </p>
    </li>
  )
}

export interface AgentBubbleProps {
  readonly motion?: BrandMarkMotion
  readonly busy?: boolean
  readonly time?: string | undefined
  readonly children: ReactNode
}

export function AgentBubble({ motion = "still", busy = false, time, children }: AgentBubbleProps) {
  const { t } = useTranslation()
  return (
    <li className={styles.agent} aria-busy={busy || undefined}>
      <span className={styles.avatar}>
        <BrandMark size="sm" motion={motion} />
      </span>
      <div className={styles.agentBody}>
        <svg className={styles.tail} viewBox="0 0 12 12" aria-hidden="true" focusable="false">
          <path className={styles.tailFill} d="M8.5 0C8.5 6 5.5 11 0 12h12V0z" />
          <path className={styles.tailEdge} d="M8.5 0C8.5 6 5.5 11 0 12h12" />
        </svg>
        <span className="visually-hidden">{t("explore:chat.agent")}</span>
        {children}
        {time ? <span className={styles.agentTime}>{time}</span> : null}
      </div>
    </li>
  )
}

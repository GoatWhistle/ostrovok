import type { ReactNode } from "react"
import { useTranslation } from "@/shared/i18n"
import { BrandMark, type BrandMarkMotion } from "@/shared/ui"
import styles from "./chat-bubble.module.css"

export function UserBubble({ children }: { readonly children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <li className={styles.user}>
      <span className="visually-hidden">{t("explore:chat.you")}</span>
      <p className={styles.userText}>{children}</p>
    </li>
  )
}

export interface AgentBubbleProps {
  readonly motion?: BrandMarkMotion
  readonly busy?: boolean
  readonly children: ReactNode
}

export function AgentBubble({ motion = "still", busy = false, children }: AgentBubbleProps) {
  const { t } = useTranslation()
  return (
    <li className={styles.agent} aria-busy={busy || undefined}>
      <span className={styles.avatar}>
        <BrandMark size="sm" motion={motion} />
      </span>
      <div className={styles.agentBody}>
        <span className="visually-hidden">{t("explore:chat.agent")}</span>
        {children}
      </div>
    </li>
  )
}

import { useTranslation } from "@/shared/i18n"
import { usePresence } from "@/shared/motion"
import { Button, ScrollArea } from "@/shared/ui"
import styles from "./chat-history.module.css"

export interface ChatHistoryProps {
  readonly id: string
  readonly activeId: string | null
  readonly conversations: readonly { readonly id: string; readonly title: string }[]
  readonly hidden: boolean
  readonly pending: boolean
  readonly onOpen: (id: string) => void
}

export function ChatHistory({
  id,
  activeId,
  conversations,
  hidden,
  pending,
  onOpen,
}: ChatHistoryProps) {
  const { t } = useTranslation()
  const presence = usePresence(!hidden)
  if (!presence.mounted) return null
  return (
    <nav
      id={id}
      className={styles.history}
      aria-label={t("explore:chat.history")}
      data-state={presence.state}
      onTransitionEnd={presence.onTransitionEnd}
    >
      <ScrollArea className={styles.scroll}>
        <ul className={styles.list}>
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <Button
                variant="ghost"
                icon="history"
                align="start"
                className={styles.item}
                aria-current={conversation.id === activeId ? "true" : undefined}
                disabled={pending}
                onClick={() => onOpen(conversation.id)}
              >
                {conversation.title || t("explore:chat.untitled")}
              </Button>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </nav>
  )
}

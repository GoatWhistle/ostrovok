import { useTranslation } from "@/shared/i18n"
import { Button } from "@/shared/ui"
import styles from "./search-chat.module.css"

export interface ChatHeaderProps {
  readonly title: string
  readonly emptyChat: boolean
  readonly onReset: () => void
  readonly onOpenChats?: (() => void) | undefined
  readonly onCollapse?: (() => void) | undefined
}

export function ChatHeader({
  title,
  emptyChat,
  onReset,
  onOpenChats,
  onCollapse,
}: ChatHeaderProps) {
  const { t } = useTranslation()
  return (
    <header className={styles.header}>
      {onOpenChats ? (
        <Button
          variant="ghost"
          iconOnly
          icon="sidebar"
          title={t("explore:chat.chats")}
          aria-haspopup="dialog"
          onClick={onOpenChats}
        >
          {t("explore:chat.chats")}
        </Button>
      ) : null}
      <p id="chat-title" className={styles.title} title={title}>
        {title}
      </p>
      <div className={styles.actions}>
        {onCollapse ? (
          <Button
            variant="ghost"
            iconOnly
            icon="chevron-down"
            title={t("explore:chat.collapseDialog")}
            onClick={onCollapse}
          >
            {t("explore:chat.collapseDialog")}
          </Button>
        ) : null}
        {onOpenChats ? (
          <Button
            variant="ghost"
            iconOnly
            icon="new-search"
            title={t("explore:chat.newSearch")}
            disabled={emptyChat}
            onClick={onReset}
          >
            {t("explore:chat.newSearch")}
          </Button>
        ) : null}
      </div>
    </header>
  )
}

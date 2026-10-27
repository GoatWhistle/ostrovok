import { useTranslation } from "@/shared/i18n"
import { Button } from "@/shared/ui"
import type { ChatView } from "./chat-view"
import styles from "./search-chat.module.css"

export interface ChatHeaderProps {
  readonly title: string
  readonly view: ChatView
  readonly historyCount: number
  readonly emptyChat: boolean
  readonly onView: (view: ChatView) => void
  readonly onReset: () => void
  readonly onCollapse?: (() => void) | undefined
}

export function ChatHeader({
  title,
  view,
  historyCount,
  emptyChat,
  onView,
  onReset,
  onCollapse,
}: ChatHeaderProps) {
  const { t } = useTranslation()
  return (
    <header className={styles.header}>
      <p id="chat-title" className={styles.title} title={title}>
        {title}
      </p>
      <div className={styles.actions}>
        <Button
          variant="ghost"
          iconOnly
          icon="history"
          className={styles.toggle}
          title={t("explore:chat.historyShort")}
          aria-pressed={view === "history"}
          disabled={historyCount === 0 && view === "chat"}
          onClick={() => onView(view === "history" ? "chat" : "history")}
        >
          {t("explore:chat.historyShort")}
        </Button>
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
        <Button
          iconOnly
          icon="plus"
          className={styles.create}
          title={t("explore:chat.newSearch")}
          disabled={view === "chat" && emptyChat}
          onClick={() => {
            onView("chat")
            onReset()
          }}
        >
          {t("explore:chat.newSearch")}
        </Button>
      </div>
    </header>
  )
}

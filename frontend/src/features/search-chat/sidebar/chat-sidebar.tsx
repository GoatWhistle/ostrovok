import { useTranslation } from "@/shared/i18n"
import { Button } from "@/shared/ui"
import styles from "./chat-sidebar.module.css"
import { ConversationList, type ConversationListProps } from "./conversation-list"

export interface ChatSidebarProps extends ConversationListProps {
  readonly collapsed: boolean
  readonly onToggle: () => void
  readonly onNew: () => void
}

export function ChatSidebar({ collapsed, onToggle, onNew, ...list }: ChatSidebarProps) {
  const { t } = useTranslation()
  const toggleLabel = collapsed ? t("explore:chat.sidebarOpen") : t("explore:chat.sidebarClose")
  return (
    <nav className={styles.sidebar} data-collapsed={collapsed} aria-label={t("explore:chat.chats")}>
      <div className={styles.top}>
        <Button
          variant="ghost"
          iconOnly
          icon="sidebar"
          title={toggleLabel}
          aria-expanded={!collapsed}
          onClick={onToggle}
        >
          {toggleLabel}
        </Button>
        <Button
          variant="ghost"
          iconOnly={collapsed}
          icon="new-search"
          align={collapsed ? "center" : "start"}
          className={styles.create}
          title={collapsed ? t("explore:chat.newSearch") : undefined}
          onClick={onNew}
        >
          {t("explore:chat.newSearch")}
        </Button>
      </div>
      {collapsed ? null : <ConversationList {...list} />}
    </nav>
  )
}

import { useTranslation } from "@/shared/i18n"
import { usePresence } from "@/shared/motion"
import { Button, Dialog } from "@/shared/ui"
import styles from "./chat-sidebar.module.css"
import { ConversationList, type ConversationListProps } from "./conversation-list"

export interface ChatsDrawerProps extends ConversationListProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly onNew: () => void
}

export function ChatsDrawer({ open, onClose, onNew, onOpen, ...list }: ChatsDrawerProps) {
  const { t } = useTranslation()
  const presence = usePresence(open, "--dur-panel-exit")
  if (!presence.mounted) return null
  return (
    <Dialog
      placement="start"
      title={t("explore:chat.chats")}
      state={presence.state}
      onAnimationEnd={(event) => {
        if (!event.nativeEvent.pseudoElement) presence.onAnimationEnd(event)
      }}
      onClose={onClose}
    >
      <div className={styles.drawer}>
        <div className={styles.drawerTop}>
          <Button
            variant="secondary"
            icon="new-search"
            align="start"
            className={styles.create}
            onClick={() => {
              onNew()
              onClose()
            }}
          >
            {t("explore:chat.newSearch")}
          </Button>
        </div>
        <ConversationList
          {...list}
          onOpen={(id) => {
            onOpen(id)
            onClose()
          }}
        />
      </div>
    </Dialog>
  )
}

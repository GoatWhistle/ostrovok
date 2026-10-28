import { SearchChat, type SearchChatProps } from "@/features/search-chat"
import { ChatDock } from "./chat-dock/chat-dock"
import styles from "./home-page.module.css"

export interface WorkspaceChatProps {
  readonly docked: boolean
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly chat: SearchChatProps
}

export function WorkspaceChat({ docked, open, onOpenChange, chat }: WorkspaceChatProps) {
  return (
    <div className={styles.chat} data-docked={docked}>
      {docked ? (
        <ChatDock open={open} onOpenChange={onOpenChange} chat={chat} />
      ) : (
        <SearchChat {...chat} />
      )}
    </div>
  )
}

import type { useHotelWorkspace } from "@/features/hotel-search"
import { ChatSidebar, type ChatSidebarState, ChatsDrawer } from "@/features/search-chat"
import styles from "./workspace-sidebar.module.css"

type Workspace = ReturnType<typeof useHotelWorkspace>

export interface WorkspaceSidebarProps {
  readonly state: Workspace
  readonly sidebar: ChatSidebarState
}

export function WorkspaceSidebar({ state, sidebar }: WorkspaceSidebarProps) {
  const list = {
    activeId: state.conversationId,
    conversations: state.history,
    onOpen: state.openConversation,
    onRename: state.renameConversation,
    onDelete: state.deleteConversation,
    onNew: () => state.reset(),
  }
  if (sidebar.inline)
    return (
      <div className={styles.sidebar}>
        <ChatSidebar {...list} collapsed={sidebar.collapsed} onToggle={sidebar.toggle} />
      </div>
    )
  return <ChatsDrawer {...list} open={sidebar.drawerOpen} onClose={sidebar.closeDrawer} />
}

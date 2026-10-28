import type { useHotelWorkspace } from "@/features/hotel-search"
import { ChatSidebar, type ChatSidebarState, ChatsDrawer } from "@/features/search-chat"
import styles from "./workspace-sidebar.module.css"

type Workspace = ReturnType<typeof useHotelWorkspace>

const PENDING_ID = "pending"

function withPending(state: Workspace) {
  if (!state.sending || !state.outgoing || state.conversationId)
    return { activeId: state.conversationId, conversations: state.history }
  const entry = {
    id: PENDING_ID,
    title: state.outgoing,
    updatedAt: new Date().toISOString(),
    pending: true,
  }
  return { activeId: PENDING_ID, conversations: [entry, ...state.history] }
}

export interface WorkspaceSidebarProps {
  readonly state: Workspace
  readonly sidebar: ChatSidebarState
}

export function WorkspaceSidebar({ state, sidebar }: WorkspaceSidebarProps) {
  const list = {
    ...withPending(state),
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

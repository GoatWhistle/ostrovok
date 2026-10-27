import type { SearchResult } from "@/shared/api/hotel-types"
import type { components } from "@/shared/api/schema.gen"
import { useFormatters, useTranslation } from "@/shared/i18n"
import { ScrollArea } from "@/shared/ui"
import { AgentFailure, AgentReply, AgentThinking } from "./agent-reply"
import { UserBubble } from "./chat-bubble"
import { ChatComposer } from "./chat-composer"
import { ChatGreeting } from "./chat-greeting"
import { ChatHeader } from "./chat-header"
import type { ChatView } from "./chat-view"
import { ChatHistory, type HistoryEntry } from "./history/chat-history"
import type { SearchResponse } from "./reply-blocks"
import styles from "./search-chat.module.css"
import { useChatFollow } from "./use-chat-follow"

export type ChatMessage = components["schemas"]["ChatMessage"]
export type { ChatView }

export interface SearchChatProps {
  readonly draftKey?: string | undefined
  readonly messages: readonly ChatMessage[]
  readonly conversationId: string | null
  readonly history: readonly HistoryEntry[]
  readonly view: ChatView
  readonly search: SearchResponse | undefined
  readonly searchMessageId?: string | null | undefined
  readonly outgoing: string | undefined
  readonly selectedHotel?: string | undefined
  readonly loading: boolean
  readonly sending: boolean
  readonly failed: boolean
  readonly onSend: (message: string) => void
  readonly onRetry: () => void
  readonly onShowOnMap: (result: SearchResult | undefined) => void
  readonly onShowList: () => void
  readonly onReset: () => void
  readonly onOpenConversation: (id: string) => void
  readonly onView: (view: ChatView) => void
  readonly onCollapse?: (() => void) | undefined
  readonly onRename: (id: string, title: string) => Promise<unknown>
  readonly onDelete: (id: string) => Promise<unknown>
}

export function SearchChat({
  draftKey,
  messages,
  conversationId,
  history,
  search,
  searchMessageId,
  outgoing,
  selectedHotel,
  loading,
  sending,
  failed,
  onSend,
  onRetry,
  onShowOnMap,
  onShowList,
  onReset,
  onOpenConversation,
  view,
  onView,
  onCollapse,
  onRename,
  onDelete,
}: SearchChatProps) {
  const { t } = useTranslation()
  const format = useFormatters()
  const { log, list } = useChatFollow(conversationId)
  const lastAssistant =
    searchMessageId === undefined
      ? messages.findLast((message) => message.role === "assistant")?.id
      : searchMessageId
  const title =
    history.find((item) => item.id === conversationId)?.title ||
    (conversationId ? t("explore:chat.untitled") : t("explore:chat.newSearch"))
  return (
    <section className={styles.chat} aria-labelledby="chat-title">
      <ChatHeader
        title={title}
        view={view}
        historyCount={history.length}
        emptyChat={conversationId === null && messages.length === 0 && !outgoing}
        onView={onView}
        onReset={onReset}
        onCollapse={onCollapse}
      />
      {view === "history" ? (
        <ChatHistory
          activeId={conversationId}
          conversations={history}
          pending={false}
          onOpen={(id) => {
            onOpenConversation(id)
            onView("chat")
          }}
          onRename={onRename}
          onDelete={onDelete}
        />
      ) : null}
      <div className={styles.body} hidden={view === "history"}>
        <ScrollArea ref={log} className={styles.log} role="log" aria-label={t("explore:chat.log")}>
          <ol ref={list} className={styles.messages}>
            {messages.length === 0 && !loading ? <ChatGreeting onSend={onSend} /> : null}
            {loading ? <AgentThinking /> : null}
            {messages.map((message) =>
              message.role === "user" ? (
                <UserBubble key={message.id} time={format.time(message.created_at)}>
                  {message.content}
                </UserBubble>
              ) : (
                <AgentReply
                  key={message.id}
                  content={message.content}
                  time={format.time(message.created_at)}
                  search={message.id === lastAssistant ? search : undefined}
                  onShowOnMap={onShowOnMap}
                  onShowList={onShowList}
                  onSend={onSend}
                />
              ),
            )}
            {outgoing ? <UserBubble>{outgoing}</UserBubble> : null}
            {sending ? <AgentThinking /> : null}
            {failed && !sending ? <AgentFailure onRetry={onRetry} /> : null}
          </ol>
        </ScrollArea>
        <div className={styles.composerArea}>
          <ChatComposer
            draftKey={draftKey ?? `chat:${conversationId ?? "new"}`}
            autoFocus={Boolean(outgoing)}
            pending={sending}
            selectedHotel={selectedHotel}
            onSend={onSend}
          />
        </div>
      </div>
    </section>
  )
}

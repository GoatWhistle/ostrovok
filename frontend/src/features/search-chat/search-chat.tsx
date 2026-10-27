import type { ChatProgress } from "@/shared/api"
import type { SearchResult } from "@/shared/api/hotel-types"
import type { components } from "@/shared/api/schema.gen"
import { useFormatters, useTranslation } from "@/shared/i18n"
import { ScrollArea } from "@/shared/ui"
import { AgentFailure, AgentReply, AgentThinking } from "./agent-reply"
import { UserBubble } from "./chat-bubble"
import { ChatComposer } from "./chat-composer"
import { ChatGreeting } from "./chat-greeting"
import { ChatHeader } from "./chat-header"
import { AgentProgress } from "./progress/agent-progress"
import type { SearchResponse } from "./reply-blocks"
import styles from "./search-chat.module.css"
import type { HistoryEntry } from "./sidebar/history-groups"
import { useChatFollow } from "./use-chat-follow"

export type ChatMessage = components["schemas"]["ChatMessage"]

export interface SearchChatProps {
  readonly draftKey?: string | undefined
  readonly messages: readonly ChatMessage[]
  readonly conversationId: string | null
  readonly history: readonly HistoryEntry[]
  readonly search: SearchResponse | undefined
  readonly searchMessageId?: string | null | undefined
  readonly outgoing: string | undefined
  readonly selectedHotel?: string | undefined
  readonly onClearHotel?: (() => void) | undefined
  readonly loading: boolean
  readonly sending: boolean
  readonly progress?: readonly ChatProgress[] | undefined
  readonly failed: boolean
  readonly onSend: (message: string) => void
  readonly onRetry: () => void
  readonly onShowOnMap: (result: SearchResult | undefined) => void
  readonly onShowList: () => void
  readonly onReset: () => void
  readonly onOpenChats?: (() => void) | undefined
  readonly onCollapse?: (() => void) | undefined
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
  onClearHotel,
  loading,
  sending,
  progress,
  failed,
  onSend,
  onRetry,
  onShowOnMap,
  onShowList,
  onReset,
  onOpenChats,
  onCollapse,
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
        emptyChat={conversationId === null && messages.length === 0 && !outgoing}
        onReset={onReset}
        onOpenChats={onOpenChats}
        onCollapse={onCollapse}
      />
      <div className={styles.body}>
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
                  named={message.id === lastAssistant && !sending && !outgoing}
                  onShowOnMap={onShowOnMap}
                  onShowList={onShowList}
                  onSend={onSend}
                />
              ),
            )}
            {outgoing ? <UserBubble>{outgoing}</UserBubble> : null}
            {sending ? <AgentProgress events={progress ?? []} /> : null}
            {failed && !sending ? <AgentFailure onRetry={onRetry} /> : null}
          </ol>
        </ScrollArea>
        <div className={styles.composerArea}>
          <ChatComposer
            draftKey={draftKey ?? `chat:${conversationId ?? "new"}`}
            autoFocus={Boolean(outgoing)}
            pending={sending}
            selectedHotel={selectedHotel}
            onClearHotel={onClearHotel}
            onSend={onSend}
          />
        </div>
      </div>
    </section>
  )
}

import { useEffect, useRef } from "react"
import type { SearchResult } from "@/shared/api/hotel-types"
import type { components } from "@/shared/api/schema.gen"
import { useFormatters, useTranslation } from "@/shared/i18n"
import { Button, ScrollArea } from "@/shared/ui"
import { AgentFailure, AgentReply, AgentThinking } from "./agent-reply"
import { UserBubble } from "./chat-bubble"
import { ChatComposer } from "./chat-composer"
import { ChatGreeting } from "./chat-greeting"
import { ChatHistory } from "./chat-history"
import type { SearchResponse } from "./reply-blocks"
import styles from "./search-chat.module.css"

export type ChatMessage = components["schemas"]["ChatMessage"]

export interface SearchChatProps {
  readonly messages: readonly ChatMessage[]
  readonly conversationId: string | null
  readonly history: readonly { readonly id: string; readonly title: string }[]
  readonly search: SearchResponse | undefined
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
}

function useFollow() {
  const log = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLOListElement>(null)
  useEffect(() => {
    const scroller = log.current
    const content = list.current
    if (!scroller || !content) return
    const observer = new ResizeObserver(() => {
      scroller.scrollTop = scroller.scrollHeight
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [])
  return { log, list }
}

export function SearchChat({
  messages,
  conversationId,
  history,
  search,
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
}: SearchChatProps) {
  const { t } = useTranslation()
  const format = useFormatters()
  const { log, list } = useFollow()
  const lastAssistant = messages.findLast((message) => message.role === "assistant")?.id
  return (
    <section className={styles.chat} aria-labelledby="chat-title">
      <header className={styles.header}>
        <p id="chat-title" className={styles.title}>
          {t("explore:chat.title")}
        </p>
        <div className={styles.actions}>
          <ChatHistory
            activeId={conversationId}
            conversations={history}
            pending={sending}
            onOpen={onOpenConversation}
          />
          <Button
            variant="ghost"
            size="compact"
            icon="new-search"
            disabled={sending || (conversationId === null && messages.length === 0 && !outgoing)}
            onClick={onReset}
          >
            {t("explore:chat.newSearch")}
          </Button>
        </div>
      </header>
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
              />
            ),
          )}
          {outgoing ? <UserBubble>{outgoing}</UserBubble> : null}
          {sending ? <AgentThinking /> : null}
          {failed && !sending ? <AgentFailure onRetry={onRetry} /> : null}
        </ol>
      </ScrollArea>
      <ChatComposer
        key={conversationId ?? "new"}
        pending={sending}
        selectedHotel={selectedHotel}
        onSend={onSend}
      />
    </section>
  )
}

import { useState } from "react"
import { useFormatters, useTranslation } from "@/shared/i18n"
import { EmptyState, ScrollArea, TextField } from "@/shared/ui"
import styles from "./chat-history.module.css"
import { HistoryRow } from "./history-row"
import { historyStamp } from "./history-stamp"

export interface HistoryEntry {
  readonly id: string
  readonly title: string
  readonly updatedAt?: string
}

export interface ChatHistoryProps {
  readonly activeId: string | null
  readonly conversations: readonly HistoryEntry[]
  readonly pending: boolean
  readonly onOpen: (id: string) => void
  readonly onRename: (id: string, title: string) => Promise<unknown>
  readonly onDelete: (id: string) => Promise<unknown>
}

export function ChatHistory({
  activeId,
  conversations,
  pending,
  onOpen,
  onRename,
  onDelete,
}: ChatHistoryProps) {
  const { t } = useTranslation()
  const format = useFormatters()
  const [query, setQuery] = useState("")
  const needle = query.trim().toLocaleLowerCase()
  const visible = needle
    ? conversations.filter((item) => item.title.toLocaleLowerCase().includes(needle))
    : conversations
  if (conversations.length === 0)
    return (
      <div className={styles.empty}>
        <EmptyState
          icon="history"
          title={t("explore:chat.historyEmpty")}
          description={t("explore:chat.historyEmptyText")}
        />
      </div>
    )
  return (
    <div className={styles.history}>
      <div className={styles.search}>
        <TextField
          label={t("explore:chat.searchHistory")}
          labelHidden
          type="search"
          placeholder={t("explore:chat.searchHistory")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <ScrollArea className={styles.scroll} aria-label={t("explore:chat.history")}>
        {visible.length ? (
          <ul className={styles.list}>
            {visible.map((item) => (
              <HistoryRow
                key={item.id}
                title={item.title || t("explore:chat.untitled")}
                date={historyStamp(format, item.updatedAt)}
                current={item.id === activeId}
                pending={pending}
                onOpen={() => onOpen(item.id)}
                onRename={(title) => onRename(item.id, title)}
                onDelete={() => onDelete(item.id)}
              />
            ))}
          </ul>
        ) : (
          <p className={styles.noMatches}>{t("explore:chat.noMatches")}</p>
        )}
      </ScrollArea>
    </div>
  )
}

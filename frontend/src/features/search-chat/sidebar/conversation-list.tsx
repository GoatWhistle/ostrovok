import { useId, useState } from "react"
import { type MessageKey, useTranslation } from "@/shared/i18n"
import { EmptyState, ScrollArea, TextField } from "@/shared/ui"
import styles from "./conversation-list.module.css"
import { groupHistory, type HistoryEntry, type HistoryGroup } from "./history-groups"
import { HistoryRow } from "./history-row"

export type { HistoryEntry }

const SEARCH_FROM = 8

const GROUP_LABEL: Readonly<Record<HistoryGroup, MessageKey>> = {
  today: "explore:chat.groupToday",
  yesterday: "explore:chat.groupYesterday",
  earlier: "explore:chat.groupEarlier",
}

export interface ConversationListProps {
  readonly activeId: string | null
  readonly conversations: readonly HistoryEntry[]
  readonly onOpen: (id: string) => void
  readonly onRename: (id: string, title: string) => Promise<unknown>
  readonly onDelete: (id: string) => Promise<unknown>
}

export function ConversationList({
  activeId,
  conversations,
  onOpen,
  onRename,
  onDelete,
}: ConversationListProps) {
  const { t } = useTranslation()
  const groupId = useId()
  const [query, setQuery] = useState("")
  const needle = query.trim().toLocaleLowerCase()
  const visible = needle
    ? conversations.filter((item) => item.title.toLocaleLowerCase().includes(needle))
    : conversations
  const sections = groupHistory(visible)
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
      {conversations.length >= SEARCH_FROM ? (
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
      ) : null}
      <ScrollArea className={styles.scroll} aria-label={t("explore:chat.history")}>
        {sections.length ? (
          sections.map((section) => (
            <section
              key={section.group}
              className={styles.section}
              aria-labelledby={`${groupId}-${section.group}`}
            >
              <p id={`${groupId}-${section.group}`} className={styles.groupTitle}>
                {t(GROUP_LABEL[section.group])}
              </p>
              <ul className={styles.list}>
                {section.entries.map((item) => (
                  <HistoryRow
                    key={item.id}
                    title={item.title || t("explore:chat.untitled")}
                    current={item.id === activeId}
                    pending={item.pending === true}
                    onOpen={() => onOpen(item.id)}
                    onRename={(title) => onRename(item.id, title)}
                    onDelete={() => onDelete(item.id)}
                  />
                ))}
              </ul>
            </section>
          ))
        ) : (
          <p className={styles.noMatches}>{t("explore:chat.noMatches")}</p>
        )}
      </ScrollArea>
    </div>
  )
}

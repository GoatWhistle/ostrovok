import { useEffect, useId, useRef, useState } from "react"
import { useTranslation } from "@/shared/i18n"
import { usePresence } from "@/shared/motion"
import { Button, Icon, ScrollArea } from "@/shared/ui"
import styles from "./chat-history.module.css"

export interface ChatHistoryProps {
  readonly activeId: string | null
  readonly conversations: readonly { readonly id: string; readonly title: string }[]
  readonly pending: boolean
  readonly onOpen: (id: string) => void
}

export function ChatHistory({ activeId, conversations, pending, onOpen }: ChatHistoryProps) {
  const { t } = useTranslation()
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const presence = usePresence(open)
  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", close)
    document.addEventListener("keydown", dismiss)
    return () => {
      document.removeEventListener("pointerdown", close)
      document.removeEventListener("keydown", dismiss)
    }
  }, [open])
  return (
    <div ref={root}>
      <Button
        variant="ghost"
        size="compact"
        iconOnly
        icon="history"
        title={t("explore:chat.history")}
        aria-expanded={open}
        aria-controls={id}
        disabled={conversations.length === 0}
        onClick={() => setOpen((current) => !current)}
      >
        {t("explore:chat.history")}
      </Button>
      {presence.mounted ? (
        <nav
          id={id}
          className={styles.panel}
          aria-label={t("explore:chat.history")}
          data-state={presence.state}
          onAnimationEnd={presence.onAnimationEnd}
        >
          <p className={styles.caption}>{t("explore:chat.history")}</p>
          <ScrollArea className={styles.scroll}>
            <ul className={styles.list}>
              {conversations.map((conversation) => {
                const current = conversation.id === activeId
                return (
                  <li key={conversation.id}>
                    <Button
                      variant="ghost"
                      align="start"
                      className={styles.item}
                      aria-current={current ? "true" : undefined}
                      disabled={pending}
                      onClick={() => {
                        onOpen(conversation.id)
                        setOpen(false)
                      }}
                    >
                      <span className={styles.itemTitle}>
                        {conversation.title || t("explore:chat.untitled")}
                      </span>
                      {current ? <Icon name="check" size="sm" className={styles.check} /> : null}
                    </Button>
                  </li>
                )
              })}
            </ul>
          </ScrollArea>
        </nav>
      ) : null}
    </div>
  )
}

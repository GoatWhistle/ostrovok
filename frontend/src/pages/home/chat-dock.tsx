import { useEffect, useRef } from "react"
import { ChatComposer, SearchChat, type SearchChatProps } from "@/features/search-chat"
import { useTranslation } from "@/shared/i18n"
import { usePresence } from "@/shared/motion"
import { Button } from "@/shared/ui"
import styles from "./chat-dock.module.css"

export interface ChatDockProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly chat: SearchChatProps
}

export function ChatDock({ open, onOpenChange, chat }: ChatDockProps) {
  const { t } = useTranslation()
  const toggle = useRef<HTMLButtonElement>(null)
  const presence = usePresence(open)
  const { sending } = chat
  useEffect(() => {
    if (sending) onOpenChange(true)
  }, [sending, onOpenChange])
  function collapse() {
    onOpenChange(false)
    toggle.current?.focus()
  }
  return (
    <div className={styles.dock}>
      {presence.mounted ? (
        <section
          className={styles.panel}
          data-state={presence.state}
          aria-label={t("explore:chat.log")}
          onAnimationEnd={presence.onAnimationEnd}
          onKeyDown={(event) => {
            if (event.key === "Escape") collapse()
          }}
        >
          <SearchChat {...chat} onCollapse={collapse} />
        </section>
      ) : (
        <div className={styles.bar}>
          <Button
            ref={toggle}
            variant="ghost"
            iconOnly
            icon="expand"
            title={t("explore:chat.openDialog")}
            aria-expanded={false}
            onClick={() => onOpenChange(true)}
          >
            {t("explore:chat.openDialog")}
          </Button>
          <ChatComposer
            flat
            draftKey={chat.draftKey}
            pending={chat.sending}
            selectedHotel={chat.selectedHotel}
            onSend={chat.onSend}
          />
        </div>
      )}
    </div>
  )
}

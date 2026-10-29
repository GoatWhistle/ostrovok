import { useEffect, useRef } from "react"
import { SearchChat, type SearchChatProps } from "@/features/search-chat"
import { useTranslation } from "@/shared/i18n"
import { usePresence } from "@/shared/motion"
import styles from "./chat-dock.module.css"
import { DockBar } from "./dock-bar"

export interface ChatDockProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly chat: SearchChatProps
}

export function ChatDock({ open, onOpenChange, chat }: ChatDockProps) {
  const { t } = useTranslation()
  const toggle = useRef<HTMLButtonElement>(null)
  const presence = usePresence(open)
  const { sending, selectedHotel } = chat
  useEffect(() => {
    if (sending && selectedHotel) onOpenChange(true)
  }, [sending, selectedHotel, onOpenChange])
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
        <DockBar chat={chat} toggleRef={toggle} onExpand={() => onOpenChange(true)} />
      )}
    </div>
  )
}

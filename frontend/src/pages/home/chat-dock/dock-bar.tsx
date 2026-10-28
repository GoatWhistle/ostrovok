import { clsx } from "clsx"
import type { Ref } from "react"
import { ChatComposer, type SearchChatProps } from "@/features/search-chat"
import { useTranslation } from "@/shared/i18n"
import { Button } from "@/shared/ui"
import styles from "./chat-dock.module.css"

export type DockBarVariant = "float" | "attached"

const VARIANT: Readonly<Record<DockBarVariant, string | undefined>> = {
  float: undefined,
  attached: styles.attached,
}

export interface DockBarProps {
  readonly chat: SearchChatProps
  readonly toggleRef?: Ref<HTMLButtonElement> | undefined
  readonly variant?: DockBarVariant
  readonly onSend?: ((message: string) => void) | undefined
  readonly onExpand: () => void
}

export function DockBar({ chat, toggleRef, variant = "float", onSend, onExpand }: DockBarProps) {
  const { t } = useTranslation()
  return (
    <div className={clsx(styles.bar, VARIANT[variant])}>
      <ChatComposer
        flat
        bare
        draftKey={chat.draftKey}
        pending={chat.sending}
        selectedHotel={chat.selectedHotel}
        onClearHotel={chat.onClearHotel}
        onSend={onSend ?? chat.onSend}
      />
      <Button
        ref={toggleRef}
        variant="ghost"
        iconOnly
        icon="expand"
        title={t("explore:chat.openDialog")}
        aria-expanded={false}
        onClick={onExpand}
      >
        {t("explore:chat.openDialog")}
      </Button>
    </div>
  )
}

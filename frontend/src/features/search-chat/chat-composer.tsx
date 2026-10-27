import { type FormEvent, useId } from "react"
import { useSessionDraft } from "@/shared/hooks"
import { useTranslation } from "@/shared/i18n"
import { Button, SearchBox, StatusBadge } from "@/shared/ui"
import styles from "./chat-composer.module.css"

export interface ChatComposerProps {
  readonly draftKey?: string | undefined
  readonly onInteraction?: (() => void) | undefined
  readonly autoFocus?: boolean
  readonly pending: boolean
  readonly selectedHotel?: string | undefined
  readonly placeholder?: string | undefined
  readonly onSend: (query: string) => void
}

export function ChatComposer({
  pending,
  selectedHotel,
  placeholder,
  onSend,
  draftKey = "chat:entry",
  onInteraction,
  autoFocus = false,
}: ChatComposerProps) {
  const { t } = useTranslation()
  const hint = useId()
  const { value, setValue } = useSessionDraft(draftKey)
  const query = value.trim()
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!query || pending) return
    onSend(query)
    setValue("")
  }
  return (
    <form className={styles.composer} onSubmit={submit}>
      {selectedHotel ? (
        <StatusBadge tone="info" icon="building" className={styles.context}>
          {t("explore:chat.selected", { name: selectedHotel })}
        </StatusBadge>
      ) : null}
      <SearchBox
        label={t("explore:chat.composer")}
        placeholder={placeholder ?? t("explore:chat.placeholder")}
        value={value}
        maxLength={2000}
        describedBy={hint}
        autoFocus={autoFocus}
        onFocus={onInteraction}
        onValueChange={(next) => {
          setValue(next)
          onInteraction?.()
        }}
        actions={
          <Button
            type="submit"
            size="compact"
            iconOnly
            icon="arrow-up"
            title={t("explore:chat.send")}
            pending={pending}
            disabled={!query}
            className={styles.send}
          >
            {t("explore:chat.send")}
          </Button>
        }
      />
      <p id={hint} className="visually-hidden">
        {t("explore:chat.hint")}
      </p>
    </form>
  )
}

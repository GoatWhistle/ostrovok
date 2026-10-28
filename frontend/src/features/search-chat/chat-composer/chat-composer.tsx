import { clsx } from "clsx"
import { type FormEvent, useId } from "react"
import { useSessionDraft } from "@/shared/hooks"
import { useTranslation } from "@/shared/i18n"
import { Button, Chip, CloseButton, SearchBox } from "@/shared/ui"
import styles from "./chat-composer.module.css"

export interface ChatComposerProps {
  readonly draftKey?: string | undefined
  readonly onInteraction?: (() => void) | undefined
  readonly autoFocus?: boolean
  readonly pending: boolean
  readonly selectedHotel?: string | undefined
  readonly onClearHotel?: (() => void) | undefined
  readonly placeholder?: string | undefined
  readonly flat?: boolean
  readonly bare?: boolean
  readonly onSend: (query: string) => void
}

function HotelToken({
  name,
  onClear,
}: {
  readonly name: string
  readonly onClear?: (() => void) | undefined
}) {
  const { t } = useTranslation()
  return (
    <Chip
      static
      pressed
      icon="building"
      hue="var(--text-accent)"
      label={name}
      title={t("explore:chat.selected", { name })}
      className={onClear ? styles.token : undefined}
      trailing={
        onClear ? (
          <CloseButton
            size="compact"
            label={t("explore:chat.clearHotel", { name })}
            onClick={onClear}
          />
        ) : undefined
      }
    />
  )
}

export function ChatComposer({
  pending,
  selectedHotel,
  onClearHotel,
  placeholder,
  onSend,
  draftKey = "chat:entry",
  onInteraction,
  autoFocus = false,
  flat = false,
  bare = false,
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
    <form className={clsx(styles.composer, flat && styles.flat)} onSubmit={submit}>
      <SearchBox
        bare={bare}
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
        leading={
          selectedHotel ? <HotelToken name={selectedHotel} onClear={onClearHotel} /> : undefined
        }
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

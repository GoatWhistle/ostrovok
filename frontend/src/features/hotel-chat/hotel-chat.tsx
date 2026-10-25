import { type FormEvent, useEffect, useRef, useState } from "react"
import type { components } from "@/shared/api/schema.gen"
import { useTranslation } from "@/shared/i18n"
import { Button, Card, ScrollArea, TextArea } from "@/shared/ui"
import styles from "./hotel-chat.module.css"

export interface HotelChatProps {
  readonly messages: readonly components["schemas"]["ChatMessage"][]
  readonly selectedHotel: string | undefined
  readonly pending: boolean
  readonly error: boolean
  readonly onSend: (message: string) => Promise<unknown>
}

export function HotelChat({ messages, selectedHotel, pending, error, onSend }: HotelChatProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState("")
  const end = useRef<HTMLDivElement>(null)
  const latestMessage = messages.at(-1)?.id
  useEffect(() => {
    if (latestMessage) end.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [latestMessage])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = draft.trim()
    if (!message || pending) return
    try {
      await onSend(message)
      setDraft("")
    } catch {
      return
    }
  }
  return (
    <Card
      as="section"
      title={t("explore:chat.title")}
      description={t("explore:chat.subtitle")}
      className={styles.chat}
    >
      <ScrollArea className={styles.thread}>
        {messages.length === 0 ? (
          <div className={styles.welcome}>
            <strong>{t("explore:chat.welcome")}</strong>
            <p>{t("explore:chat.welcomeText")}</p>
          </div>
        ) : null}
        {messages.map((message) => (
          <div
            key={message.id}
            className={message.role === "user" ? styles.userMessage : styles.assistantMessage}
          >
            <span>
              {message.role === "user" ? t("explore:chat.you") : t("explore:chat.assistant")}
            </span>
            <p>{message.content}</p>
          </div>
        ))}
        {pending ? <p className={styles.working}>{t("explore:chat.working")}</p> : null}
        <div ref={end} />
      </ScrollArea>
      <form className={styles.composer} onSubmit={submit}>
        {selectedHotel ? (
          <p className={styles.context}>{t("explore:chat.selected", { name: selectedHotel })}</p>
        ) : null}
        {error ? (
          <p role="alert" className={styles.error}>
            {t("explore:chat.error")}
          </p>
        ) : null}
        <TextArea
          label={t("explore:chat.message")}
          placeholder={t("explore:chat.placeholder")}
          value={draft}
          rows={3}
          maxLength={2000}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
          }}
        />
        <Button type="submit" icon="search" pending={pending} disabled={!draft.trim()}>
          {t("explore:chat.send")}
        </Button>
      </form>
    </Card>
  )
}

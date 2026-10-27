import { type FormEvent, useState } from "react"
import { useTranslation } from "@/shared/i18n"
import { Button, TextField } from "@/shared/ui"
import styles from "./conversation-list.module.css"

export interface HistoryRowProps {
  readonly title: string
  readonly current: boolean
  readonly onOpen: () => void
  readonly onRename: (title: string) => Promise<unknown>
  readonly onDelete: () => Promise<unknown>
}

type Mode = "idle" | "rename" | "confirm"

const TITLE_LIMIT = 80

export function HistoryRow({ title, current, onOpen, onRename, onDelete }: HistoryRowProps) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<Mode>("idle")
  const [draft, setDraft] = useState(title)
  const [busy, setBusy] = useState(false)
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await action()
      setMode("idle")
    } finally {
      setBusy(false)
    }
  }
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const next = draft.trim()
    if (!next || next === title) {
      setMode("idle")
      return
    }
    void run(() => onRename(next))
  }
  if (mode === "rename")
    return (
      <li className={styles.row} data-mode="rename">
        <form className={styles.renameForm} onSubmit={save}>
          <TextField
            label={t("explore:chat.renameLabel")}
            labelHidden
            value={draft}
            maxLength={TITLE_LIMIT}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setMode("idle")
            }}
          />
          <Button type="submit" size="compact" iconOnly icon="check" pending={busy}>
            {t("explore:chat.save")}
          </Button>
          <Button
            variant="ghost"
            size="compact"
            iconOnly
            icon="close"
            onClick={() => setMode("idle")}
          >
            {t("explore:chat.cancel")}
          </Button>
        </form>
      </li>
    )
  if (mode === "confirm")
    return (
      <li className={styles.row} data-mode="confirm">
        <p className={styles.confirm}>{t("explore:chat.deleteConfirm", { title })}</p>
        <div className={styles.confirmActions}>
          <Button variant="reject" size="compact" pending={busy} onClick={() => void run(onDelete)}>
            {t("explore:chat.delete")}
          </Button>
          <Button variant="ghost" size="compact" onClick={() => setMode("idle")}>
            {t("explore:chat.cancel")}
          </Button>
        </div>
      </li>
    )
  return (
    <li className={styles.row} data-current={current}>
      <Button
        variant="ghost"
        align="start"
        className={styles.open}
        title={title}
        aria-current={current ? "page" : undefined}
        onClick={onOpen}
      >
        <span className={styles.itemTitle}>{title}</span>
      </Button>
      <span className={styles.rowActions}>
        <Button
          variant="ghost"
          size="compact"
          iconOnly
          icon="edit"
          title={t("explore:chat.rename")}
          onClick={() => {
            setDraft(title)
            setMode("rename")
          }}
        >
          {t("explore:chat.rename")}
        </Button>
        <Button
          variant="ghost"
          size="compact"
          iconOnly
          icon="delete"
          title={t("explore:chat.delete")}
          onClick={() => setMode("confirm")}
        >
          {t("explore:chat.delete")}
        </Button>
      </span>
    </li>
  )
}

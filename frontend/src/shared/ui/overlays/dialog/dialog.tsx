import { type ReactNode, useEffect, useId, useRef } from "react"
import { useTranslation } from "../../../i18n"
import { Button } from "../../primitives/button/button"
import styles from "./dialog.module.css"

export interface DialogProps {
  readonly title: string
  readonly onClose: () => void
  readonly children: ReactNode
}

export function Dialog({ title, onClose, children }: DialogProps) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const titleRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    const dialog = ref.current
    const previous = document.activeElement
    dialog?.showModal()
    titleRef.current?.focus({ preventScroll: true })
    return () => {
      dialog?.close()
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <header className={styles.header}>
        <h2 ref={titleRef} tabIndex={-1} id={titleId} className={styles.title}>
          {title}
        </h2>
        <Button icon="close" iconOnly variant="ghost" onClick={onClose}>
          {t("common:action.close")}
        </Button>
      </header>
      {children}
    </dialog>
  )
}

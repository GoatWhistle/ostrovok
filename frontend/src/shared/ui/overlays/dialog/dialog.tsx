import { clsx } from "clsx"
import { type AnimationEventHandler, type ReactNode, useEffect, useId, useRef } from "react"
import { useTranslation } from "../../../i18n"
import type { PresenceState } from "../../../motion"
import { Button } from "../../primitives/button/button"
import styles from "./dialog.module.css"

export type DialogPlacement = "center" | "start"

export interface DialogProps {
  readonly title: string
  readonly onClose: () => void
  readonly children: ReactNode
  readonly placement?: DialogPlacement
  readonly state?: PresenceState
  readonly onAnimationEnd?: AnimationEventHandler<HTMLDialogElement>
}

const PLACEMENT_CLASS: Readonly<Record<DialogPlacement, string | undefined>> = {
  center: undefined,
  start: styles.start,
}

export function Dialog({
  title,
  onClose,
  children,
  placement = "center",
  state,
  onAnimationEnd,
}: DialogProps) {
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
      className={clsx(styles.dialog, PLACEMENT_CLASS[placement])}
      data-state={state}
      aria-labelledby={titleId}
      onAnimationEnd={onAnimationEnd}
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

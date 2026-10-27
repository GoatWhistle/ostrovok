import { clsx } from "clsx"
import { type ReactNode, useEffect, useId, useRef, useState } from "react"
import { usePresence } from "../../../motion/use-presence"
import { Button } from "../../primitives/button/button"
import styles from "./settings-menu.module.css"

export interface SettingsMenuProps {
  readonly label: string
  readonly surface?: "plain" | "glass"
  readonly children: ReactNode
}

export function SettingsMenu({ label, surface = "plain", children }: SettingsMenuProps) {
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [instant, setInstant] = useState(false)
  const [open, setOpen] = useState(false)
  const presence = usePresence(open, "--dur-exit", instant)
  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return
      if (document.querySelector("dialog[open]")) return
      event.preventDefault()
      setInstant(true)
      setOpen(false)
      trigger.current?.focus({ preventScroll: true })
    }
    document.addEventListener("pointerdown", close)
    document.addEventListener("keydown", dismiss)
    return () => {
      document.removeEventListener("pointerdown", close)
      document.removeEventListener("keydown", dismiss)
    }
  }, [open])
  return (
    <div ref={root} className={styles.root}>
      <Button
        ref={trigger}
        variant="ghost"
        iconOnly
        icon="settings"
        aria-expanded={open}
        aria-controls={id}
        className={clsx(surface === "glass" && styles.glass)}
        onClick={(event) => {
          setInstant(event.detail === 0)
          setOpen((current) => !current)
        }}
      >
        {label}
      </Button>
      {presence.mounted ? (
        <section
          id={id}
          className={styles.panel}
          aria-label={label}
          data-state={presence.state}
          data-instant={instant}
          inert={!open}
          onAnimationEnd={presence.onAnimationEnd}
        >
          {children}
        </section>
      ) : null}
    </div>
  )
}

export function SettingsRow({
  label,
  children,
}: {
  readonly label: string
  readonly children: ReactNode
}) {
  return (
    <div className={styles.row}>
      <p className={styles.label}>{label}</p>
      {children}
    </div>
  )
}

export function SettingsFooter({ children }: { readonly children: ReactNode }) {
  return <div className={styles.footer}>{children}</div>
}

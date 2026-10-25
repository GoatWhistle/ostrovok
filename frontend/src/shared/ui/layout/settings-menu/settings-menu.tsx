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
  const [open, setOpen] = useState(false)
  const presence = usePresence(open)
  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
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
        variant="ghost"
        iconOnly
        icon="settings"
        aria-expanded={open}
        aria-controls={id}
        className={clsx(surface === "glass" && styles.glass)}
        onClick={() => setOpen((current) => !current)}
      >
        {label}
      </Button>
      {presence.mounted ? (
        <section
          id={id}
          className={styles.panel}
          aria-label={label}
          data-state={presence.state}
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

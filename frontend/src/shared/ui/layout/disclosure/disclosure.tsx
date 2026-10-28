import { type ReactNode, useId, useRef, useState } from "react"
import { usePresence } from "../../../motion/use-presence"
import { prefersReducedMotion } from "../../../motion/use-reduced-motion"
import { withViewTransition } from "../../../motion/with-view-transition"
import { Icon, type IconName } from "../../primitives/icon/icon"
import styles from "./disclosure.module.css"

export interface DisclosureProps {
  readonly title: string
  readonly icon?: IconName
  readonly defaultOpen?: boolean
  readonly children: ReactNode
}

function canMorph() {
  return typeof document.startViewTransition === "function" && !prefersReducedMotion()
}

export function Disclosure({ title, icon, defaultOpen = false, children }: DisclosureProps) {
  const id = useId()
  const [open, setOpen] = useState(defaultOpen)
  const [instant, setInstant] = useState(false)
  const presence = usePresence(open, "--dur-exit", instant)
  const root = useRef<HTMLDivElement>(null)
  const morphName = `disclosure-${id.replace(/[^a-zA-Z0-9]/g, "")}`
  function toggle(keyboard: boolean) {
    const element = root.current
    if (keyboard || !element || !canMorph()) {
      setInstant(keyboard)
      setOpen((value) => !value)
      return
    }
    setInstant(true)
    element.style.viewTransitionName = morphName
    void withViewTransition("layout", () => setOpen((value) => !value)).finally(() => {
      element.style.viewTransitionName = ""
    })
  }
  return (
    <div ref={root} className={styles.disclosure}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={id}
        data-instant={instant}
        onClick={(event) => toggle(event.detail === 0)}
      >
        {icon ? <Icon name={icon} size="sm" className={styles.icon} /> : null}
        <span>{title}</span>
        <Icon name="chevron-down" size="sm" className={styles.chevron} />
      </button>
      {presence.mounted ? (
        <div
          id={id}
          className={styles.panel}
          data-state={presence.state}
          data-instant={instant}
          inert={!open}
          onTransitionEnd={presence.onTransitionEnd}
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}

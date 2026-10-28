import { clsx } from "clsx"
import { type ReactNode, useEffect, useId, useRef, useState } from "react"
import { usePresence } from "../../../motion/use-presence"
import { prefersReducedMotion } from "../../../motion/use-reduced-motion"
import { withViewTransition } from "../../../motion/with-view-transition"
import { Icon, type IconName } from "../../primitives/icon/icon"
import styles from "./disclosure.module.css"

export interface DisclosureProps {
  readonly title: string
  readonly expandedTitle?: string
  readonly iconOnly?: boolean
  readonly open?: boolean | undefined
  readonly onOpenChange?: ((open: boolean) => void) | undefined
  readonly icon?: IconName
  readonly defaultOpen?: boolean
  readonly revealOnOpen?: boolean
  readonly children: ReactNode
}

function canMorph() {
  return typeof document.startViewTransition === "function" && !prefersReducedMotion()
}

export function Disclosure({
  title,
  expandedTitle,
  iconOnly = false,
  open: controlledOpen,
  onOpenChange,
  icon,
  defaultOpen = false,
  revealOnOpen = false,
  children,
}: DisclosureProps) {
  const id = useId()
  const [internalOpen, setOpen] = useState(defaultOpen)
  const open = controlledOpen ?? internalOpen
  const label = open ? (expandedTitle ?? title) : title
  const [instant, setInstant] = useState(false)
  const presence = usePresence(open, "--dur-exit", instant)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (open && revealOnOpen)
      root.current?.scrollIntoView?.({ block: "start", behavior: "instant" })
  }, [open, revealOnOpen])
  const morphName = `disclosure-${id.replace(/[^a-zA-Z0-9]/g, "")}`
  function toggle(keyboard: boolean) {
    const element = root.current
    const changeOpen = () => {
      if (controlledOpen === undefined) setOpen((value) => !value)
      onOpenChange?.(!open)
    }
    if (keyboard || !element || !canMorph() || controlledOpen !== undefined) {
      setInstant(keyboard)
      changeOpen()
      return
    }
    setInstant(true)
    element.style.viewTransitionName = morphName
    void withViewTransition("layout", changeOpen).finally(() => {
      element.style.viewTransitionName = ""
    })
  }
  return (
    <div ref={root} className={styles.disclosure}>
      <button
        type="button"
        className={clsx(styles.trigger, iconOnly && styles.iconOnly)}
        title={iconOnly ? label : undefined}
        aria-expanded={open}
        aria-controls={id}
        data-instant={instant}
        onClick={(event) => toggle(event.detail === 0)}
      >
        {icon ? <Icon name={icon} size="sm" className={styles.icon} /> : null}
        <span className={iconOnly ? "visually-hidden" : undefined}>{label}</span>
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

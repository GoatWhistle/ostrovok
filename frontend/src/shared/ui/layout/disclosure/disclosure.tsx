import { type ReactNode, useId, useState } from "react"
import { usePresence } from "../../../motion/use-presence"
import { Icon, type IconName } from "../../primitives/icon/icon"
import styles from "./disclosure.module.css"

export interface DisclosureProps {
  readonly title: string
  readonly icon?: IconName
  readonly defaultOpen?: boolean
  readonly children: ReactNode
}

export function Disclosure({ title, icon, defaultOpen = false, children }: DisclosureProps) {
  const id = useId()
  const [open, setOpen] = useState(defaultOpen)
  const [instant, setInstant] = useState(false)
  const presence = usePresence(open, "--dur-exit", instant)
  return (
    <div className={styles.disclosure}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={id}
        data-instant={instant}
        onClick={(event) => {
          setInstant(event.detail === 0)
          setOpen((value) => !value)
        }}
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

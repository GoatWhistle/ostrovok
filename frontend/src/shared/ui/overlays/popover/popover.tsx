import type { ReactNode } from "react"
import { createPortal } from "react-dom"
import { Button } from "../../primitives/button/button"
import type { IconName } from "../../primitives/icon/icon"
import styles from "./popover.module.css"
import { type PopoverPlacement, usePopover } from "./use-popover"

export interface PopoverProps {
  readonly label: string
  readonly icon: IconName
  readonly summary?: ReactNode
  readonly children: ReactNode
  readonly placement?: PopoverPlacement
}

export function Popover({ label, icon, summary, children, placement = "top" }: PopoverProps) {
  const state = usePopover(placement)
  return (
    <>
      <Button
        ref={state.trigger}
        variant="ghost"
        className={styles.trigger}
        icon={icon}
        iconOnly={summary === undefined}
        aria-label={label}
        title={label}
        aria-expanded={state.open}
        aria-controls={state.id}
        onClick={(event) => {
          state.setInstant(event.detail === 0)
          state.setOpen((value) => !value)
        }}
      >
        {summary ?? label}
      </Button>
      {state.presence.mounted
        ? createPortal(
            <section
              ref={state.panel}
              id={state.id}
              aria-label={label}
              tabIndex={-1}
              inert={!state.open}
              className={styles.panel}
              style={state.position}
              data-state={state.presence.state}
              data-placement={placement}
              data-instant={state.instant}
              onTransitionEnd={state.presence.onTransitionEnd}
            >
              {children}
            </section>,
            document.body,
          )
        : null}
    </>
  )
}

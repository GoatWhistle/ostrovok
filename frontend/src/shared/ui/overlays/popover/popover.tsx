import { clsx } from "clsx"
import type { PointerEvent, ReactNode } from "react"
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
  readonly hover?: boolean
  readonly inline?: boolean
}

function mouse(event: PointerEvent, action: () => void) {
  if (event.pointerType === "mouse") action()
}

export function Popover({
  label,
  icon,
  summary,
  children,
  placement = "top",
  hover = false,
  inline = false,
}: PopoverProps) {
  const state = usePopover(placement)
  const pointer = hover
    ? {
        onPointerEnter: (event: PointerEvent) => mouse(event, state.hover.enter),
        onPointerLeave: (event: PointerEvent) => mouse(event, state.hover.leave),
      }
    : {}
  return (
    <>
      <Button
        ref={state.trigger}
        variant="ghost"
        className={inline ? styles.inline : styles.trigger}
        icon={icon}
        iconOnly={summary === undefined}
        aria-label={label}
        title={hover ? undefined : label}
        aria-expanded={state.open}
        aria-controls={state.id}
        onClick={(event) => {
          state.setInstant(event.detail === 0)
          if (state.open && state.hovered) state.hover.pin()
          else state.setOpen((value) => !value)
        }}
        {...pointer}
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
              className={clsx(styles.panel, inline && styles.compact)}
              style={state.position}
              data-state={state.presence.state}
              data-placement={placement}
              data-instant={state.instant}
              onTransitionEnd={state.presence.onTransitionEnd}
              {...pointer}
            >
              {children}
            </section>,
            document.body,
          )
        : null}
    </>
  )
}

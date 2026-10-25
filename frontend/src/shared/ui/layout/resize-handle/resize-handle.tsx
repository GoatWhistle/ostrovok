import type { Resizable, ResizeEdge } from "../../../hooks/use-resizable"
import styles from "./resize-handle.module.css"

export interface ResizeHandleProps {
  readonly label: string
  readonly edge: ResizeEdge
  readonly current: number
  readonly resizable: Resizable
}

export function ResizeHandle({ label, edge, current, resizable }: ResizeHandleProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a focusable splitter cannot be an hr element
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={resizable.min}
      aria-valuemax={resizable.max}
      aria-valuenow={Math.round(current)}
      tabIndex={0}
      className={styles.handle}
      data-edge={edge}
      onPointerDown={resizable.onPointerDown}
      onKeyDown={resizable.onKeyDown}
      onDoubleClick={resizable.onDoubleClick}
    >
      <span className={styles.line} aria-hidden="true" />
    </div>
  )
}

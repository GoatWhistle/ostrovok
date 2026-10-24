import { clsx } from "clsx"
import type { ReactNode } from "react"
import styles from "./scroll-area.module.css"
export interface ScrollAreaProps {
  readonly children: ReactNode
  readonly className?: string | undefined
}
export function ScrollArea({ children, className }: ScrollAreaProps) {
  return <div className={clsx(styles.scroll, className)}>{children}</div>
}

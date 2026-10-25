import { clsx } from "clsx"
import type { HTMLAttributes, ReactNode, Ref } from "react"
import styles from "./scroll-area.module.css"
export interface ScrollAreaProps extends Omit<HTMLAttributes<HTMLDivElement>, "className"> {
  readonly children: ReactNode
  readonly className?: string | undefined
  readonly ref?: Ref<HTMLDivElement>
}
export function ScrollArea({ children, className, ref, ...rest }: ScrollAreaProps) {
  return (
    <div {...rest} ref={ref} className={clsx(styles.scroll, className)}>
      {children}
    </div>
  )
}

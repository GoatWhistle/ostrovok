import { clsx } from "clsx"
import type { ReactNode } from "react"
import { Button, type ButtonProps } from "@/shared/ui"
import styles from "./row-button.module.css"

export interface RowButtonProps extends Omit<ButtonProps, "children" | "variant" | "align"> {
  readonly leading: ReactNode
  readonly trailing?: ReactNode
  readonly leadingAlign?: "center" | "start"
  readonly children: ReactNode
}

export function RowButton({
  leading,
  trailing,
  leadingAlign = "center",
  children,
  className,
  ...rest
}: RowButtonProps) {
  return (
    <Button {...rest} variant="ghost" align="start" className={clsx(styles.row, className)}>
      <span className={styles.face} data-align={leadingAlign}>
        {leading}
        <span className={styles.body}>{children}</span>
        {trailing === undefined ? null : <span className={styles.trailing}>{trailing}</span>}
      </span>
    </Button>
  )
}

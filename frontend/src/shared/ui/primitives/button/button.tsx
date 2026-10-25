import { clsx } from "clsx"
import type { ButtonHTMLAttributes, MouseEvent, ReactNode, Ref } from "react"
import { Icon, type IconName } from "../icon/icon"
import styles from "./button.module.css"

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "fact"
  | "confirm"
  | "reject"
export type ButtonSize = "regular" | "compact" | "hero"

export const VARIANT_CLASS: Readonly<Record<ButtonVariant, string | undefined>> = {
  primary: styles.primary,
  secondary: styles.secondary,
  outline: styles.outline,
  ghost: styles.ghost,
  fact: styles.fact,
  confirm: styles.confirm,
  reject: styles.reject,
}

export const SIZE_CLASS: Readonly<Record<ButtonSize, string | undefined>> = {
  regular: undefined,
  compact: styles.compact,
  hero: styles.hero,
}

export interface ButtonContentProps {
  readonly icon?: IconName | undefined
  readonly pending?: boolean
  readonly iconOnly?: boolean
  readonly children: ReactNode
}

export function ButtonContent({
  icon,
  pending = false,
  iconOnly = false,
  children,
}: ButtonContentProps) {
  return (
    <>
      <span className={styles.content} data-pending={pending}>
        {icon === undefined ? null : <Icon name={icon} size="sm" className={styles.icon} />}
        <span className={iconOnly ? "visually-hidden" : undefined}>{children}</span>
      </span>
      {pending ? <Icon name="loader" size="sm" className={styles.loader} /> : null}
    </>
  )
}

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "type"> {
  readonly align?: "center" | "start"
  readonly variant?: ButtonVariant
  readonly size?: ButtonSize
  readonly icon?: IconName | undefined
  readonly pending?: boolean
  readonly iconOnly?: boolean
  readonly type?: "button" | "submit"
  readonly ref?: Ref<HTMLButtonElement> | undefined
  readonly children: ReactNode
}

export function Button({
  variant = "primary",
  size = "regular",
  icon,
  pending = false,
  iconOnly = false,
  type = "button",
  className,
  onClick,
  children,
  align = "center",
  ...rest
}: ButtonProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (pending) {
      event.preventDefault()
      return
    }
    onClick?.(event)
  }
  return (
    <button
      {...rest}
      data-align={align}
      type={type}
      className={clsx(
        styles.button,
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        iconOnly && styles.iconOnly,
        className,
      )}
      aria-busy={pending || undefined}
      aria-disabled={pending || undefined}
      onClick={handleClick}
    >
      <ButtonContent icon={icon} pending={pending} iconOnly={iconOnly}>
        {children}
      </ButtonContent>
    </button>
  )
}

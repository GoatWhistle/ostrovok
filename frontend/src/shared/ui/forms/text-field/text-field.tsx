import { clsx } from "clsx"
import { type InputHTMLAttributes, type TextareaHTMLAttributes, useId } from "react"
import styles from "./text-field.module.css"
export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly label: string
  readonly labelHidden?: boolean
}
export function TextField({ label, labelHidden = false, className, id, ...props }: TextFieldProps) {
  const generated = useId()
  return (
    <label className={styles.field} htmlFor={id ?? generated}>
      <span className={labelHidden ? "visually-hidden" : styles.label}>{label}</span>
      <input {...props} id={id ?? generated} className={clsx(styles.input, className)} />
    </label>
  )
}
export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  readonly label: string
}
export function TextArea({ label, className, id, ...props }: TextAreaProps) {
  const generated = useId()
  return (
    <label className={styles.field} htmlFor={id ?? generated}>
      <span className={styles.label}>{label}</span>
      <textarea
        {...props}
        id={id ?? generated}
        className={clsx(styles.input, styles.area, className)}
      />
    </label>
  )
}

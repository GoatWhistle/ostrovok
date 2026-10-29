import { ArrowUp } from "lucide-react"
import type { ReactNode } from "react"
import styles from "./chat-ui.module.css"

export function ChatWindow({
  title,
  children,
  className,
}: {
  readonly title: string
  readonly children: ReactNode
  readonly className?: string
}) {
  return (
    <div className={className ? `${styles.window} ${className}` : styles.window}>
      <header className={styles.header}>{title}</header>
      <div className={styles.thread}>{children}</div>
    </div>
  )
}

export function UserBubble({ children, time }: { readonly children: ReactNode; readonly time: string }) {
  return (
    <div className={styles.user}>
      <p className={styles.userText}>{children}</p>
      <span className={styles.time}>{time}</span>
    </div>
  )
}

export function AgentCard({ children }: { readonly children: ReactNode }) {
  return (
    <div className={styles.agentRow}>
      <span className={styles.avatar}>
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M5 14 22 8v42L5 56Z" className={styles.side} />
          <path d="M25 8l14 6v42l-14-6Z" className={styles.fact} />
          <path d="M42 14 59 8v42l-17 6Z" className={styles.side} />
        </svg>
      </span>
      <div className={styles.agent}>{children}</div>
    </div>
  )
}

export function Composer({ text, placeholder }: { readonly text: string; readonly placeholder: string }) {
  return (
    <div className={styles.composer} data-filled={text.length > 0}>
      <span className={styles.composerText}>{text || placeholder}</span>
      <span className={styles.send}>
        <ArrowUp aria-hidden="true" />
      </span>
    </div>
  )
}

export function Chip({ children, active }: { readonly children: ReactNode; readonly active?: boolean }) {
  return (
    <span className={styles.chip} data-active={active}>
      {children}
    </span>
  )
}

export { styles as chatStyles }

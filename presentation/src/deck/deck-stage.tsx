import { type ReactNode, useLayoutEffect, useRef } from "react"
import styles from "./deck-stage.module.css"

export function DeckStage({ children }: { readonly children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = frame.current
    if (!element) return
    const fit = () =>
      element.style.setProperty("--deck-scale", String(Math.min(window.innerWidth / 1920, window.innerHeight / 1080)))
    fit()
    window.addEventListener("resize", fit)
    return () => window.removeEventListener("resize", fit)
  }, [])
  return (
    <div className={styles.viewport}>
      <div ref={frame} className={styles.frame}>
        {children}
      </div>
    </div>
  )
}

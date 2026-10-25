import styles from "./brand-mark.module.css"

export type BrandMarkMotion = "enter" | "loading" | "still"
export type BrandMarkSize = "sm" | "md" | "lg" | "xl"

export interface BrandMarkProps {
  readonly motion?: BrandMarkMotion
  readonly size?: BrandMarkSize
}

const SIZE: Readonly<Record<BrandMarkSize, string | undefined>> = {
  sm: styles.sm,
  md: styles.md,
  lg: styles.lg,
  xl: styles.xl,
}

const LEFT = "M5 14 22 8v42L5 56Z"
const MIDDLE = "M25 8l14 6v42l-14-6Z"
const RIGHT = "M42 14 59 8v42l-17 6Z"

export function BrandMark({ motion = "still", size = "md" }: BrandMarkProps) {
  return (
    <svg
      className={`${styles.mark} ${SIZE[size] ?? ""}`}
      data-motion-state={motion}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      {motion === "loading" ? (
        <g className={styles.ghost}>
          <path d={LEFT} />
          <path d={MIDDLE} />
          <path d={RIGHT} />
        </g>
      ) : null}
      <path className={styles.left} d={LEFT} />
      <path className={styles.middle} d={MIDDLE} />
      <path className={styles.right} d={RIGHT} />
    </svg>
  )
}

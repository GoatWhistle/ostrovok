import { useLoadingIndicator } from "../../../motion"
import { BrandMark } from "../../data-display/brand-mark/brand-mark"
import styles from "./journey-loader.module.css"

export function JourneyLoader({
  title,
  description,
}: {
  readonly title: string
  readonly description?: string | undefined
}) {
  const indicator = useLoadingIndicator({ pending: true, hasData: false })
  return (
    <div
      className={styles.loader}
      role="status"
      aria-label={title}
      aria-busy="true"
      data-visible={indicator !== "none"}
    >
      <BrandMark size="lg" motion="loading" />
      <p className={styles.title}>{title}</p>
      {description ? <p className={styles.description}>{description}</p> : null}
    </div>
  )
}

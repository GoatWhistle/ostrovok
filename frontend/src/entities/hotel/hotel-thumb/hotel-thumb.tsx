import { clsx } from "clsx"
import { Icon } from "@/shared/ui"
import styles from "./hotel-thumb.module.css"

export interface HotelThumbProps {
  readonly src: string | null | undefined
  readonly className?: string | undefined
}

export function HotelThumb({ src, className }: HotelThumbProps) {
  return (
    <div className={clsx(styles.thumb, className)}>
      {src ? (
        <img src={src} alt="" loading="lazy" className={styles.photo} />
      ) : (
        <Icon name="building" size="lg" className={styles.placeholder} />
      )}
    </div>
  )
}

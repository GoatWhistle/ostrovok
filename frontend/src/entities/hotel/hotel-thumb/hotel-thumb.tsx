import { clsx } from "clsx"
import { useState } from "react"
import type { components } from "@/shared/api/schema.gen"
import { sourceUrl } from "@/shared/api/source-url"
import styles from "./hotel-thumb.module.css"

export interface HotelThumbProps {
  readonly src?: string | null | undefined
  readonly photos?: readonly components["schemas"]["HotelPhoto"][] | undefined
  readonly className?: string | undefined
}

export function HotelThumb({ src, photos, className }: HotelThumbProps) {
  const [failed, setFailed] = useState<readonly string[]>([])
  const candidates = [
    ...new Set(
      [src, ...(photos ?? []).map((photo) => photo.url)].flatMap((value) => {
        const url = sourceUrl(value)
        return url ? [url] : []
      }),
    ),
  ]
  const current = candidates.find((url) => !failed.includes(url))
  if (!current) return null
  return (
    <div className={clsx(styles.thumb, className)} data-hotel-photo>
      <img
        src={current}
        alt=""
        loading="lazy"
        className={styles.photo}
        onError={() => setFailed((values) => [...values, current])}
      />
    </div>
  )
}

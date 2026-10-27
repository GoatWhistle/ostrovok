import { clsx } from "clsx"
import { useState } from "react"
import type { components } from "@/shared/api/schema.gen"
import { sourceUrl } from "@/shared/api/source-url"
import { Icon } from "@/shared/ui"
import styles from "./hotel-thumb.module.css"

export interface HotelThumbProps {
  readonly src?: string | null | undefined
  readonly photos?: readonly components["schemas"]["HotelPhoto"][] | undefined
  readonly extra?: readonly string[] | undefined
  readonly placeholder?: boolean
  readonly className?: string | undefined
}

export function HotelThumb({
  src,
  photos,
  extra,
  placeholder = false,
  className,
}: HotelThumbProps) {
  const [failed, setFailed] = useState<readonly string[]>([])
  const candidates = [
    ...new Set(
      [src, ...(photos ?? []).map((photo) => photo.url), ...(extra ?? [])].flatMap((value) => {
        const url = sourceUrl(value)
        return url ? [url] : []
      }),
    ),
  ]
  const current = candidates.find((url) => !failed.includes(url))
  if (!current && !placeholder) return null
  return (
    <div
      className={clsx(styles.thumb, className)}
      data-hotel-photo
      data-empty={!current || undefined}
    >
      <Icon name="building" className={styles.empty} />
      {current ? (
        <img
          key={current}
          src={current}
          alt=""
          loading="lazy"
          decoding="async"
          className={styles.photo}
          onError={() => setFailed((values) => [...values, current])}
        />
      ) : null}
    </div>
  )
}

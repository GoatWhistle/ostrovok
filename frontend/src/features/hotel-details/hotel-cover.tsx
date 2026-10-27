import { useState } from "react"
import { useTranslation } from "@/shared/i18n"
import { Button } from "@/shared/ui"
import styles from "./hotel-cover.module.css"

export function HotelCover({
  photos,
  name,
}: {
  readonly photos: readonly string[]
  readonly name: string
}) {
  const { t } = useTranslation()
  const [index, setIndex] = useState(0)
  const [broken, setBroken] = useState<ReadonlySet<string>>(() => new Set())
  const visible = photos.filter((url) => !broken.has(url))
  const current = Math.min(index, visible.length - 1)
  const src = visible[current]
  if (!src) return null
  return (
    <figure className={styles.cover} aria-label={t("explore:hotelCover.photos")}>
      <img
        key={src}
        className={styles.photo}
        src={src}
        alt={t("explore:rooms.photoAlt", { name, number: current + 1 })}
        onError={() => setBroken((previous) => new Set(previous).add(src))}
      />
      {visible.length > 1 ? (
        <>
          <Button
            variant="secondary"
            size="compact"
            icon="chevron-left"
            iconOnly
            className={styles.previous}
            disabled={current === 0}
            onClick={() => setIndex(current - 1)}
          >
            {t("explore:rooms.previousPhoto")}
          </Button>
          <Button
            variant="secondary"
            size="compact"
            icon="chevron-right"
            iconOnly
            className={styles.next}
            disabled={current === visible.length - 1}
            onClick={() => setIndex(current + 1)}
          >
            {t("explore:rooms.nextPhoto")}
          </Button>
          <figcaption className={styles.count} aria-live="polite">
            {t("explore:rooms.photoCount", { current: current + 1, total: visible.length })}
          </figcaption>
        </>
      ) : null}
    </figure>
  )
}

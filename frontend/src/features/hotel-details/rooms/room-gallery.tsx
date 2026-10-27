import { useState } from "react"
import { useTranslation } from "@/shared/i18n"
import { Button } from "@/shared/ui"
import styles from "./rooms.module.css"

export function RoomGallery({
  photos,
  name,
  title,
}: {
  readonly photos: readonly string[]
  readonly name: string
  readonly title?: string
}) {
  const { t } = useTranslation()
  const [index, setIndex] = useState(0)
  const [failed, setFailed] = useState(false)
  const src = photos[index]
  function select(value: number) {
    setIndex(value)
    setFailed(false)
  }
  if (!src) return <p>{t("explore:rooms.noPhotos")}</p>
  return (
    <section className={styles.gallery} aria-label={title ?? t("explore:rooms.photos")}>
      {failed ? (
        <div className={styles.empty} role="status">
          <p>{t("explore:rooms.photoError")}</p>
          <Button variant="secondary" onClick={() => setFailed(false)}>
            {t("common:action.retry")}
          </Button>
        </div>
      ) : (
        <img
          className={styles.photo}
          src={src}
          alt={t("explore:rooms.photoAlt", { name, number: index + 1 })}
          onError={() => setFailed(true)}
        />
      )}
      <div className={styles.navigation}>
        <Button
          variant="secondary"
          icon="chevron-left"
          iconOnly
          disabled={index === 0}
          onClick={() => select(index - 1)}
        >
          {t("explore:rooms.previousPhoto")}
        </Button>
        <p aria-live="polite">
          {t("explore:rooms.photoCount", { current: index + 1, total: photos.length })}
        </p>
        <Button
          variant="secondary"
          icon="chevron-right"
          iconOnly
          disabled={index === photos.length - 1}
          onClick={() => select(index + 1)}
        >
          {t("explore:rooms.nextPhoto")}
        </Button>
      </div>
    </section>
  )
}

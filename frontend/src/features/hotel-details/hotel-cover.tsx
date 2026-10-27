import { useEffect, useState } from "react"
import { useTranslation } from "@/shared/i18n"
import { Button, Skeleton, Spinner } from "@/shared/ui"
import styles from "./hotel-cover.module.css"

const PRELOAD_AROUND = 1

function usePreload(urls: readonly string[], current: number) {
  useEffect(() => {
    for (let offset = -PRELOAD_AROUND; offset <= PRELOAD_AROUND; offset += 1) {
      const url = urls[current + offset]
      if (offset !== 0 && url) new Image().src = url
    }
  }, [urls, current])
}

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
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(() => new Set())
  const visible = photos.filter((url) => !broken.has(url))
  const current = Math.min(index, visible.length - 1)
  const src = visible[current]
  usePreload(visible, current)
  if (!src) return null
  const ready = loaded.has(src)
  return (
    <figure className={styles.cover} aria-label={t("explore:hotelCover.photos")}>
      <img
        key={src}
        className={styles.photo}
        data-ready={ready}
        src={src}
        alt={t("explore:rooms.photoAlt", { name, number: current + 1 })}
        onLoad={() => setLoaded((previous) => new Set(previous).add(src))}
        onError={() => setBroken((previous) => new Set(previous).add(src))}
      />
      {ready ? null : (
        <div className={styles.loading}>
          <Skeleton shape="block" className={styles.skeleton} />
          <Spinner label={t("explore:hotelCover.loading")} className={styles.spinner} />
        </div>
      )}
      {visible.length > 1 ? (
        <>
          <Button
            variant="ghost"
            icon="chevron-left"
            iconOnly
            className={styles.previous}
            disabled={current === 0}
            onClick={() => setIndex(current - 1)}
          >
            {t("explore:rooms.previousPhoto")}
          </Button>
          <Button
            variant="ghost"
            icon="chevron-right"
            iconOnly
            className={styles.next}
            disabled={current === visible.length - 1}
            onClick={() => setIndex(current + 1)}
          >
            {t("explore:rooms.nextPhoto")}
          </Button>
          <figcaption className={styles.count} aria-live="polite">
            {t("explore:hotelCover.count", { current: current + 1, total: visible.length })}
          </figcaption>
        </>
      ) : null}
    </figure>
  )
}

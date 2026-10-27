import { useTranslation } from "@/shared/i18n"
import { Card } from "@/shared/ui"
import type { StoryFrame } from "../playback/story-frame"
import styles from "./window-story.module.css"

export function WindowStory({ frame }: { readonly frame: StoryFrame }) {
  const { t } = useTranslation()
  const panoramaStyle = { transform: `scale(${1.08 - 0.08 * frame.drift})` }
  const leftStyle = { transform: `translateX(${-102 * frame.open}%)` }
  const rightStyle = { transform: `translateX(${102 * frame.open}%)` }
  return (
    <div className={styles.world} style={{ opacity: frame.world }} aria-hidden={frame.world === 0}>
      <div className={styles.window} aria-hidden="true">
        <img
          className={styles.panorama}
          src="/illustrations/cover-coast.svg"
          alt=""
          style={panoramaStyle}
        />
        <div className={styles.shutter} style={leftStyle} />
        <div className={styles.shutter} data-side="right" style={rightStyle} />
      </div>
      <div
        className={styles.result}
        style={{ opacity: frame.finish }}
        aria-hidden={frame.finish === 0}
      >
        <Card as="div" className={styles.copy} title={t("explore:cover.finalTitle")}>
          <p>{t("explore:cover.finalNote")}</p>
        </Card>
        <figure className={styles.inset}>
          <img src="/illustrations/cover-inset.svg" alt={t("explore:cover.insetAlt")} />
          <figcaption>{t("explore:cover.seaDirection")}</figcaption>
        </figure>
      </div>
      <p className={styles.disclaimer}>
        <strong>{t("explore:cover.illustration")}</strong>
        <span>{t("explore:cover.disclaimer")}</span>
      </p>
    </div>
  )
}

import { useTranslation } from "@/shared/i18n"
import { MapAttribution } from "@/shared/ui"
import styles from "./scene-reel.module.css"
import { useSceneReel } from "./use-scene-reel"

export function SceneReel() {
  const { t } = useTranslation()
  const reel = useSceneReel(styles.pin ?? "")
  return (
    <figure className={styles.reel} data-shown={reel.shown} data-failed={reel.failed || undefined}>
      <div ref={reel.container} className={styles.canvas} aria-hidden="true" />
      <MapAttribution
        className={styles.attribution}
        label={t("explore:map.attributionTitle")}
        osm={t("explore:map.attribution")}
        terrain={t("explore:map.terrainAttribution")}
      />
    </figure>
  )
}

import { createPortal } from "react-dom"
import { useTranslation } from "@/shared/i18n"
import { MapAttribution, SeaRipples } from "@/shared/ui"
import { ReelMark } from "./reel-mark"
import styles from "./scene-reel.module.css"
import { useSceneReel } from "./use-scene-reel"

export function SceneReel() {
  const { t } = useTranslation()
  const reel = useSceneReel()
  return (
    <figure className={styles.reel} data-shown={reel.shown} data-failed={reel.failed || undefined}>
      <div ref={reel.container} className={styles.canvas} aria-hidden="true" />
      <SeaRipples map={reel.instance} ready={reel.ready} className={styles.ripples} />
      {reel.marks.map((mark) => createPortal(<ReelMark mark={mark} />, mark.element, mark.key))}
      <MapAttribution
        className={styles.attribution}
        label={t("explore:map.attributionTitle")}
        osm={t("explore:map.attribution")}
        terrain={t("explore:map.terrainAttribution")}
      />
    </figure>
  )
}

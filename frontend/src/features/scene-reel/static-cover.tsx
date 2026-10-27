import { useMemo } from "react"
import { useTranslation } from "@/shared/i18n"
import { CoverSources } from "./cover-sources"
import { storyFrame } from "./playback/story-frame"
import { coverTiming } from "./playback/timing"
import styles from "./scene-reel.module.css"
import { WindowStory } from "./story/window-story"

export function StaticCover() {
  const { t } = useTranslation()
  const frame = useMemo(
    () =>
      storyFrame(
        Number.MAX_SAFE_INTEGER,
        coverTiming(),
        0,
        0,
        (x) => x,
        (x) => x,
      ),
    [],
  )
  return (
    <figure className={styles.reel} aria-label={t("explore:cover.title")} data-cover-static="true">
      <WindowStory frame={frame} />
      <CoverSources className={styles.attribution} />
    </figure>
  )
}

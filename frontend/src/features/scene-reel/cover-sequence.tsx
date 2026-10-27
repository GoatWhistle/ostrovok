import { useMemo, useRef } from "react"
import { useTranslation } from "@/shared/i18n"
import { motionCurve, useReducedMotion } from "@/shared/motion"
import { Button } from "@/shared/ui"
import { CoverSources } from "./cover-sources"
import { useCoverMap } from "./map/use-cover-map"
import { useStoryCamera } from "./map/use-story-camera"
import { storyFrame } from "./playback/story-frame"
import { coverTiming } from "./playback/timing"
import { useStoryClock } from "./playback/use-story-clock"
import { useStoryViewport } from "./playback/use-story-viewport"
import styles from "./scene-reel.module.css"
import { RouteStory } from "./story/route-story"
import { WindowStory } from "./story/window-story"

export function CoverSequence({ interruption }: { readonly interruption: number }) {
  const { t } = useTranslation()
  const target = useRef<HTMLElement>(null)
  const viewport = useStoryViewport(target)
  const reduced = useReducedMotion()
  const timing = useMemo(coverTiming, [])
  const ease = useMemo(() => motionCurve("--ease-out"), [])
  const fold = useMemo(() => motionCurve("--ease-fold"), [])
  const map = useCoverMap(!reduced && viewport.visible, viewport.visible)
  const enabled = map.loaded && !map.failed
  const clock = useStoryClock({
    target,
    total: timing.total,
    enabled,
    visible: viewport.visible,
    reduced,
    interruption,
  })
  const frame = storyFrame(clock.time, timing, viewport.width, viewport.height, ease, fold)
  const marks = useStoryCamera(map.instance, map.ready, frame, map.colors)
  const controls = !enabled || reduced || !clock.supported
  const finished = clock.elapsed >= timing.total
  const toggle = clock.playing ? clock.pause : finished ? clock.replay : clock.play
  const label = clock.playing ? t("explore:cover.pause") : t("explore:cover.play")
  return (
    <figure
      ref={target}
      className={styles.reel}
      aria-label={t("explore:cover.title")}
      data-cover-playing={clock.playing}
      data-cover-time={Math.round(clock.time)}
    >
      <div
        ref={map.container}
        className={styles.canvas}
        style={{ opacity: 1 - frame.world }}
        aria-hidden="true"
      />
      <RouteStory frame={frame} time={clock.time} timing={timing} {...marks} />
      <WindowStory frame={frame} />
      <div className={styles.controls}>
        <Button
          variant="secondary"
          icon={clock.playing ? "pause" : "play"}
          iconOnly
          aria-label={label}
          title={label}
          disabled={controls}
          onClick={toggle}
        >
          {label}
        </Button>
        <Button
          variant="secondary"
          icon="retry"
          iconOnly
          aria-label={t("explore:cover.replay")}
          title={t("explore:cover.replay")}
          disabled={controls}
          onClick={clock.replay}
        >
          {t("explore:cover.replay")}
        </Button>
      </div>
      <CoverSources className={styles.attribution} />
    </figure>
  )
}

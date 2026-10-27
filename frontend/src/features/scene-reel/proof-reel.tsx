import { useMemo, useRef } from "react"
import { useTranslation } from "@/shared/i18n"
import { motionCurve } from "@/shared/motion"
import { Button } from "@/shared/ui"
import { CoverSources } from "./cover-sources"
import { useCoverMap } from "./map/use-cover-map"
import { useReelCamera } from "./map/use-reel-camera"
import { reelFrame, stillFrame } from "./playback/reel-frame"
import { reelTiming } from "./playback/timing"
import { useReelClock } from "./playback/use-reel-clock"
import { useStoryViewport } from "./playback/use-story-viewport"
import styles from "./scene-reel.module.css"
import { SHOTS, STILL } from "./shots"
import { ProofOverlay } from "./story/proof-overlay"

const COMPACT_WIDTH = 500
const GRADE = 0.22

interface ProofReelProps {
  readonly interruption: number
  readonly still: boolean
}

export function ProofReel({ interruption, still }: ProofReelProps) {
  const { t } = useTranslation()
  const target = useRef<HTMLElement>(null)
  const viewport = useStoryViewport(target)
  const timing = useMemo(reelTiming, [])
  const ease = useMemo(() => motionCurve("--ease-out"), [])
  const fold = useMemo(() => motionCurve("--ease-fold"), [])
  const compact = viewport.width > 0 && viewport.width < COMPACT_WIDTH
  const cameras = useMemo(
    () =>
      (still ? [STILL] : SHOTS.flatMap((shot) => [shot.from, shot.to])).map((camera) =>
        compact ? { ...camera, zoom: camera.zoom - 0.7 } : camera,
      ),
    [still, compact],
  )
  const map = useCoverMap(viewport.visible, viewport.visible, cameras)
  const shown = map.loaded && !map.failed
  const clock = useReelClock({ enabled: shown && !still, visible: viewport.visible, interruption })
  const frame = still ? stillFrame(compact) : reelFrame(clock.elapsed, timing, compact, ease, fold)
  const padding = useMemo(
    () => ({
      top: Math.round(viewport.height * (compact ? 0.16 : 0.1)),
      bottom: Math.round(viewport.height * (compact ? 0.12 : 0.14)),
    }),
    [viewport.height, compact],
  )
  const anchors = useReelCamera(map.instance, shown, frame, map.colors, padding)
  const label = clock.playing ? t("explore:cover.pause") : t("explore:cover.play")
  return (
    <figure
      ref={target}
      className={styles.reel}
      aria-label={t("explore:cover.title")}
      data-cover-shown={shown}
      data-cover-playing={clock.running}
      data-cover-shot={frame.index}
    >
      <div ref={map.container} className={styles.canvas} aria-hidden="true" />
      <div
        className={styles.grade}
        style={{ opacity: GRADE + GRADE * frame.proofs.sunset.draw * frame.proofs.sunset.opacity }}
        aria-hidden="true"
      />
      {shown && <ProofOverlay frame={frame} anchors={anchors} />}
      <div className={styles.controls}>
        <CoverSources className={undefined} />
        {!still && (
          <Button
            variant="secondary"
            icon={clock.playing ? "pause" : "play"}
            iconOnly
            aria-label={label}
            title={label}
            disabled={!shown}
            onClick={clock.toggle}
          >
            {label}
          </Button>
        )}
      </div>
    </figure>
  )
}

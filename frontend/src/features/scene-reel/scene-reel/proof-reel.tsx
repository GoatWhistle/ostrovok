import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "@/shared/i18n"
import { motionCurve } from "@/shared/motion"
import { useCoverMap } from "../map/use-cover-map"
import { useReelCamera } from "../map/use-reel-camera"
import { reelFrame, stillFrame } from "../playback/reel-frame"
import { reelTiming } from "../playback/timing"
import { useReelClock } from "../playback/use-reel-clock"
import { useStoryViewport } from "../playback/use-story-viewport"
import { ProofOverlay } from "../proof-overlay/proof-overlay"
import { SHOTS, STILL } from "../shots"
import { CoverSources } from "./cover-sources"
import styles from "./scene-reel.module.css"

const COMPACT_WIDTH = 500
const GRADE = 0.16
const SUNSET_GRADE = 0.22

export function ProofReel({ still }: { readonly still: boolean }) {
  const { t } = useTranslation()
  const target = useRef<HTMLElement>(null)
  const viewport = useStoryViewport(target)
  const timing = useMemo(reelTiming, [])
  const ease = useMemo(() => motionCurve("--ease-out"), [])
  const compact = viewport.width > 0 && viewport.width < COMPACT_WIDTH
  const cameras = useMemo(
    () =>
      (still ? [STILL] : SHOTS.flatMap((shot) => [shot.from, shot.to])).map((camera) =>
        compact ? { ...camera, zoom: camera.zoom - 0.7 } : camera,
      ),
    [still, compact],
  )
  const [golden, setGolden] = useState(still)
  const map = useCoverMap(viewport.visible, viewport.visible, cameras, golden)
  const shown = map.loaded && !map.failed
  const elapsed = useReelClock(shown && !still && viewport.visible)
  const frame = still
    ? stillFrame(compact)
    : reelFrame(elapsed + timing.flight, timing, compact, ease)
  const padding = useMemo(
    () => ({
      top: Math.round(viewport.height * (compact ? 0.16 : 0.1)),
      bottom: Math.round(viewport.height * (compact ? 0.12 : 0.14)),
    }),
    [viewport.height, compact],
  )
  const sunsetShot = still || frame.index === 1
  useEffect(() => setGolden(sunsetShot), [sunsetShot])
  const anchors = useReelCamera(map.instance, shown, frame, map.colors, padding, golden)
  return (
    <figure
      ref={target}
      className={styles.reel}
      aria-label={t("explore:cover.title")}
      data-cover-shown={shown}
      data-cover-playing={shown && !still && viewport.visible}
      data-cover-shot={frame.index}
    >
      <div ref={map.container} className={styles.canvas} aria-hidden="true" />
      <div
        className={styles.grade}
        style={{
          opacity: GRADE + SUNSET_GRADE * frame.proofs.sunset.draw * frame.proofs.sunset.opacity,
        }}
        aria-hidden="true"
      />
      {shown && <ProofOverlay anchors={anchors} />}
      <div className={styles.controls}>
        <CoverSources className={undefined} />
      </div>
    </figure>
  )
}

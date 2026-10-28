import { useTranslation } from "@/shared/i18n"
import { type ReelAnchors, RINGS } from "../map/use-reel-camera"
import type { ReelFrame } from "../playback/reel-frame"
import { SEA_MINUTES, SHOTS } from "../shots"
import { ProofLabel } from "./proof-label"
import styles from "./proof-overlay.module.css"

interface ProofOverlayProps {
  readonly frame: ReelFrame
  readonly anchors: ReelAnchors
}

export function ProofOverlay({ frame, anchors }: ProofOverlayProps) {
  const { t } = useTranslation()
  const sunset = frame.proofs.sunset
  return (
    <div className={styles.overlay} aria-hidden="true">
      <svg className={styles.paths} role="presentation">
        <g ref={anchors.ray} style={{ opacity: sunset.opacity * Math.min(1, sunset.draw * 3) }}>
          <path className={styles.cone} />
          <path className={styles.ray} />
          <circle className={styles.glow} r={40} />
          <circle className={styles.sun} r={11} />
        </g>
        <g className={styles.rings}>
          {RINGS.map((id, step) => (
            <path
              key={id}
              ref={(element) => {
                anchors.rings.current[step] = element
              }}
              className={styles.ring}
            />
          ))}
        </g>
      </svg>
      {SHOTS.map((shot) => (
        <ProofLabel
          key={shot.kind}
          anchor={anchors[shot.kind]}
          kind={shot.kind}
          text={t(shot.label, { minutes: SEA_MINUTES })}
          progress={frame.proofs[shot.kind].label}
          caret={frame.caret}
        />
      ))}
    </div>
  )
}

import { useTranslation } from "@/shared/i18n"
import type { ReelAnchors } from "../map/use-reel-camera"
import { SEA_MINUTES, SHOTS } from "../shots"
import { ProofLabel } from "./proof-label"
import styles from "./proof-overlay.module.css"

export function ProofOverlay({ anchors }: { readonly anchors: ReelAnchors }) {
  const { t } = useTranslation()
  return (
    <div className={styles.overlay} aria-hidden="true">
      {SHOTS.map((shot) => (
        <ProofLabel
          key={shot.kind}
          anchor={anchors[shot.kind]}
          kind={shot.kind}
          text={t(shot.label, { minutes: SEA_MINUTES })}
        />
      ))}
    </div>
  )
}

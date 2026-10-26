import { type MessageKey, useTranslation } from "@/shared/i18n"
import { usePresence } from "@/shared/motion"
import { EmptyState, ErrorState, JourneyLoader } from "@/shared/ui"
import styles from "./hotel-map.module.css"
import type { HotelTextureStatus } from "./texture/use-textured-hotel"

export interface MapStatusProps {
  readonly hasCamera: boolean
  readonly sceneError: boolean
  readonly failed: boolean
  readonly ready: boolean
  readonly onRetry: () => void
}

function MapLoading({ loading }: { readonly loading: boolean }) {
  const { t } = useTranslation()
  const presence = usePresence(loading)
  if (!presence.mounted) return null
  return (
    <div
      className={styles.loading}
      data-state={presence.state}
      onAnimationEnd={presence.onAnimationEnd}
    >
      <JourneyLoader title={t("explore:map.loading")} />
    </div>
  )
}

export function MapStatus({ hasCamera, sceneError, failed, ready, onRetry }: MapStatusProps) {
  const { t } = useTranslation()
  if (failed)
    return (
      <div className={styles.state}>
        <div className={styles.stateCard}>
          <EmptyState
            icon="map"
            title={t("explore:map.unsupported")}
            description={t("explore:map.unsupportedText")}
          />
        </div>
      </div>
    )
  if (sceneError)
    return (
      <div className={styles.state}>
        <div className={styles.stateCard}>
          <ErrorState title={t("explore:map.error")} onRetry={onRetry} />
        </div>
      </div>
    )
  if (!hasCamera)
    return (
      <div className={styles.state}>
        <div className={styles.stateCard}>
          <EmptyState
            icon="map"
            title={t("explore:map.empty")}
            description={t("explore:map.emptyText")}
          />
        </div>
      </div>
    )
  return <MapLoading loading={!ready} />
}

export function mapNotes(
  invalid: boolean,
  missingHeight: boolean,
  textureStatus: HotelTextureStatus,
): MessageKey[] {
  const notes: MessageKey[] = []
  if (textureStatus === "ready") notes.push("explore:map.textureApproximate")
  if (textureStatus === "unavailable") notes.push("explore:map.textureUnavailable")
  if (invalid) notes.push("explore:map.geodataInvalid")
  else if (missingHeight) notes.push("explore:map.noHeight")
  return notes
}

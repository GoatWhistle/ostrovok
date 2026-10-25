import { useTranslation } from "@/shared/i18n"
import { useLatched, usePresence } from "@/shared/motion"
import { EmptyState, ErrorState, Icon, JourneyLoader, StatusBadge } from "@/shared/ui"
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

export function MapWarning({
  invalid,
  missingHeight,
  textureStatus,
}: {
  readonly invalid: boolean
  readonly missingHeight: boolean
  readonly textureStatus: HotelTextureStatus
}) {
  const { t } = useTranslation()
  const quality = invalid
    ? t("explore:map.geodataInvalid")
    : missingHeight
      ? t("explore:map.noHeight")
      : undefined
  if (textureStatus !== "none")
    return (
      <>
        <StatusBadge tone="warning" className={styles.warning}>
          {t(
            textureStatus === "ready"
              ? "explore:map.textureApproximate"
              : "explore:map.textureUnavailable",
          )}
        </StatusBadge>
        {quality ? (
          <StatusBadge tone="warning" className={styles.warning}>
            {quality}
          </StatusBadge>
        ) : null}
      </>
    )
  if (!invalid && !missingHeight) return null
  return (
    <StatusBadge tone="warning" className={styles.warning}>
      {invalid ? t("explore:map.geodataInvalid") : t("explore:map.noHeight")}
    </StatusBadge>
  )
}

export interface MapFocusProps {
  readonly label: string | undefined
  readonly explanation: string | undefined
  readonly route: boolean
}

export function MapFocus({ label, explanation, route }: MapFocusProps) {
  const open = label !== undefined
  const presence = usePresence(open)
  const content = {
    label: useLatched(label, open),
    explanation: useLatched(explanation, open),
    route: useLatched(route, open),
  }
  if (!presence.mounted || !content.label) return null
  return (
    <div
      className={styles.focus}
      role="status"
      data-state={presence.state}
      data-route={content.route}
      onAnimationEnd={presence.onAnimationEnd}
    >
      <span className={styles.focusIcon} aria-hidden="true">
        <Icon name={content.route ? "walk" : "map"} size="sm" />
      </span>
      <span className={styles.focusText}>
        <strong className={styles.focusTitle}>{content.label}</strong>
        {content.explanation ? (
          <span className={styles.focusNote}>{content.explanation}</span>
        ) : null}
      </span>
    </div>
  )
}

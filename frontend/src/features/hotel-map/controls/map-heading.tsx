import type { FactBrief, MatchedProperty } from "@/shared/api/hotel-types"
import { useTranslation } from "@/shared/i18n"
import { Button, ErrorState } from "@/shared/ui"
import { MapFocus } from "../map-focus"
import { WalkSummary } from "../markers/walk-summary"
import { type focusCopy, hasLine } from "../scene-data"
import styles from "./map-heading.module.css"

export function MapHeading({
  fullMap,
  onExit,
  focus,
  fact,
  property,
  features,
  failed,
  onRetry,
}: {
  readonly fullMap: boolean
  readonly onExit: (() => void) | undefined
  readonly focus: ReturnType<typeof focusCopy>
  readonly fact: FactBrief | undefined
  readonly property: MatchedProperty | undefined
  readonly features: readonly unknown[]
  readonly failed: boolean
  readonly onRetry: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className={styles.topStart} data-map-obstacle>
      {fullMap ? (
        <Button variant="secondary" icon="back" onClick={onExit}>
          {t("explore:map.exitFullscreen")}
        </Button>
      ) : null}
      <MapFocus
        label={focus.label}
        explanation={focus.explanation}
        fact={fact}
        property={property}
        route={hasLine(features)}
      >
        <WalkSummary features={features} />
      </MapFocus>
      {failed ? (
        <div className={styles.notice}>
          <ErrorState title={t("explore:map.geometryError")} onRetry={onRetry} />
        </div>
      ) : null}
    </div>
  )
}

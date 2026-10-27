import type { MapAppearance } from "@/shared/geo/appearance/types"
import { useTranslation } from "@/shared/i18n"
import { requestMapAppearance, retryMapAppearance, useMapAppearance } from "@/shared/theme"
import { Button, Popover, Segmented } from "@/shared/ui"
import styles from "./map-appearance-control.module.css"

export function MapAppearanceControl({
  onChange,
}: {
  readonly onChange: (id: MapAppearance) => void
}) {
  const { t } = useTranslation()
  const { id, failed } = useMapAppearance()
  return (
    <Popover label={t("explore:map.appearance")} icon="map" placement="bottom">
      <div className={styles.body}>
        <strong>{t("explore:map.appearance")}</strong>
        <Segmented<MapAppearance>
          label={t("explore:map.appearance")}
          options={[
            { value: "neon", label: t("explore:map.neon"), icon: "theme-dark" },
            { value: "toy-town", label: t("explore:map.toyTown"), icon: "building" },
          ]}
          value={id}
          onChange={(value) => {
            if (requestMapAppearance(value)) onChange(value)
          }}
        />
        {failed ? (
          <>
            <p role="alert">{t("explore:map.appearanceError")}</p>
            <Button
              variant="secondary"
              icon="retry"
              onClick={() => {
                const value = retryMapAppearance()
                if (value) onChange(value)
              }}
            >
              {t("explore:map.retryAppearance")}
            </Button>
          </>
        ) : null}
      </div>
    </Popover>
  )
}

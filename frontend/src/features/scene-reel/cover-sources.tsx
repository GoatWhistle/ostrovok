import { useTranslation } from "@/shared/i18n"
import { MapAttribution } from "@/shared/ui"

export function CoverSources({ className }: { readonly className: string | undefined }) {
  const { t } = useTranslation()
  return (
    <MapAttribution
      placement="below"
      size="regular"
      className={className}
      label={t("explore:map.attributionTitle")}
      osm={t("explore:map.attribution")}
      terrain={t("explore:map.terrainAttribution")}
    />
  )
}

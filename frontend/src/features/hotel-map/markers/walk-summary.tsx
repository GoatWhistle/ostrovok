import { walkLabel } from "@/entities/place"
import { featureCollection } from "@/shared/geo/geometry/geometry"
import { useLocale, useTranslation } from "@/shared/i18n"

export function WalkSummary({ features }: { readonly features: readonly unknown[] }) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const all = featureCollection(features).features
  const routes = all
    .filter((item) => item.properties?.place_id)
    .sort((a, b) => Number(a.properties?.distance_m) - Number(b.properties?.distance_m))
  const first = routes[0]?.properties
  if (!first) return null
  const points = all.filter((item) => String(item.id).startsWith("g_poi_"))
  const remaining = Math.max(0, points.length - routes.length)
  return (
    <>
      <span>
        {t("explore:place.nearest", { value: walkLabel(first.minutes, first.distance_m, locale) })}
      </span>
      {remaining > 0 ? <span>{t("explore:place.withoutRoute", { count: remaining })}</span> : null}
    </>
  )
}

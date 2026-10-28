import type { SearchJourney } from "@/shared/api/search-journey"
import type { SearchPreview } from "@/shared/api/search-preview"
import { useTranslation } from "@/shared/i18n"

export function SearchSceneCopy({
  scene,
  journey,
}: {
  readonly scene: SearchPreview
  readonly journey: SearchJourney
}) {
  const { t } = useTranslation()
  if (scene.mode === "onsite")
    return (
      <p>
        {t("explore:searchMap.onsite", {
          name: scene.place_name || t("explore:searchMap.unnamed"),
        })}
      </p>
    )
  if (scene.meters == null) return <p>{t("explore:searchMap.checkingHotel")}</p>
  const shorter =
    !journey.winner &&
    scene.mode === "graph" &&
    journey.previews?.some(
      (other) =>
        (other.mode === "onsite" || other.mode === "graph") &&
        other.meters != null &&
        other.meters < (scene.meters ?? 0),
    )
  return (
    <>
      <p>
        {t("explore:searchMap.target", {
          name: scene.place_name || t("explore:searchMap.unnamed"),
        })}
      </p>
      <p>
        {t(scene.mode === "graph" ? "explore:searchMap.walk" : "explore:searchMap.straight", {
          meters: Math.round(scene.meters),
          minutes: Math.ceil(scene.minutes ?? 0),
          term: scene.term ?? "",
        })}
      </p>
      {shorter ? <p>{t("explore:searchMap.longer")}</p> : null}
    </>
  )
}

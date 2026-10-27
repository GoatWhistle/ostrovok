import type { HotelSummary } from "@/shared/api/hotel-types"
import { sourceUrl } from "@/shared/api/source-url"
import { useTranslation } from "@/shared/i18n"
import { ButtonLink } from "@/shared/ui"
import { DetailsSection } from "../details-section"
import { RoomGallery } from "./room-gallery"

export function HotelPhotos({ hotel }: { readonly hotel: HotelSummary }) {
  const { t } = useTranslation()
  const photos = (hotel.photos ?? []).filter((item) => sourceUrl(item.url))
  const urls = [
    ...new Set(
      [hotel.thumbnail_url, ...photos.map((item) => item.url)].flatMap((url) =>
        sourceUrl(url) ? [sourceUrl(url) as string] : [],
      ),
    ),
  ]
  const sources = [
    ...new Set(
      photos.flatMap((item) =>
        sourceUrl(item.source_url) ? [sourceUrl(item.source_url) as string] : [],
      ),
    ),
  ]
  return (
    <DetailsSection title={t("explore:cards.hotelPhotos")} hint={t("explore:cards.photoViewNote")}>
      <RoomGallery
        key={hotel.id}
        photos={urls}
        name={hotel.name}
        title={t("explore:cards.hotelPhotos")}
      />
      {sources.map((url) => (
        <ButtonLink
          key={url}
          to={url}
          target="_blank"
          rel="noreferrer"
          variant="ghost"
          icon="source"
        >
          {t("explore:details.openSource")}
        </ButtonLink>
      ))}
    </DetailsSection>
  )
}

import type { components } from "@/shared/api/schema.gen"
import { useTranslation } from "@/shared/i18n"
import { Banner } from "@/shared/ui"
import { RoomCatalog } from "../rooms/room-catalog"

type Offers = components["schemas"]["HotelOffers"]
type Room = components["schemas"]["SupplierRoom"]

export function roomGroups(
  content: Offers | undefined,
  catalog: readonly Room[] | undefined,
): readonly Room[] {
  if (content?.room_groups?.length) return content.room_groups
  return catalog ?? []
}

export function SupplierSection({
  hotelId,
  rooms,
  content,
  stay,
  dated,
}: {
  readonly hotelId: string
  readonly rooms: readonly Room[]
  readonly content: Offers | undefined
  readonly stay: string
  readonly dated: boolean
}) {
  const { t } = useTranslation()
  return (
    <>
      {rooms.length && !dated ? (
        <Banner tone="neutral" title={t("explore:rooms.needStay")} />
      ) : null}
      {rooms.length ? (
        <RoomCatalog key={`${hotelId}:${stay}`} hotelId={hotelId} rooms={rooms} content={content} />
      ) : null}
    </>
  )
}

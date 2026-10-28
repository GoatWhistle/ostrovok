import { useId, useState } from "react"
import { amenityGroupName, amenityName } from "@/entities/hotel"
import type { components } from "@/shared/api/schema.gen"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Disclosure, Icon } from "@/shared/ui"
import { HotelFacilities } from "../hotel-facilities/hotel-facilities"
import { amenityDescriptions } from "../supplier/amenity-descriptions"
import { amenityGroupIcon, amenityIcon } from "../supplier/amenity-icons"
import styles from "./hotel-amenities.module.css"

type Amenity = components["schemas"]["SupplierAmenity"]

export interface HotelAmenitiesProps {
  readonly card: components["schemas"]["HotelCard"]
  readonly supplier: components["schemas"]["SupplierDetails"] | undefined
}

function AmenityList({
  items,
  descriptions,
  group,
}: {
  readonly group: string
  readonly items: readonly Amenity[]
  readonly descriptions: ReadonlyMap<Amenity, readonly string[]>
}) {
  const { locale } = useLocale()
  return (
    <ul className={styles.list}>
      {items.map((item) => {
        const name = amenityName(item.name, locale)
        const notes = descriptions.get(item)
        return (
          <li className={styles.item} key={item.name} lang={name.lang}>
            {notes?.length ? (
              <Disclosure title={name.text} icon={amenityIcon(item.name, group)}>
                <div className={styles.notes}>
                  {notes.map((text) => (
                    <p className={styles.description} key={text} lang="ru">
                      {text}
                    </p>
                  ))}
                </div>
              </Disclosure>
            ) : (
              <span className={styles.face}>
                <Icon name={amenityIcon(item.name, group)} size="sm" className={styles.itemIcon} />
                <span className={styles.name}>{name.text}</span>
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function HotelAmenities({ card, supplier }: HotelAmenitiesProps) {
  const { locale } = useLocale()
  const { t } = useTranslation()
  const [active, setActive] = useState<string>()
  const notesId = useId()
  const groups = supplier?.amenity_groups.filter((group) => group.amenities.length) ?? []
  const single = groups.length === 1 && groups[0]?.amenities.length === 1
  const { descriptions, remaining } = amenityDescriptions(groups, supplier?.description ?? [])
  return (
    <div className={styles.amenities}>
      {groups.length ? null : (
        <section className={styles.group}>
          <HotelFacilities
            hotelId={card.hotel.id}
            facilitiesRu={card.facilities_ru ?? []}
            facilitiesEn={card.facilities_en ?? []}
            emptyText={t("explore:hotelCard.amenitiesEmpty")}
            open={active === `${notesId}-facilities`}
            onOpenChange={(open) => setActive(open ? `${notesId}-facilities` : undefined)}
          />
        </section>
      )}
      {groups.map((group) => {
        const heading = amenityGroupName(group.name, locale)
        const list = (
          <AmenityList items={group.amenities} descriptions={descriptions} group={group.name} />
        )
        return (
          <section
            className={styles.group}
            key={group.name}
            lang={heading.lang}
            data-amenity-group={group.name}
          >
            {single ? (
              list
            ) : (
              <Disclosure
                title={heading.text}
                icon={amenityGroupIcon(group.name)}
                open={active === group.name}
                onOpenChange={(open) => setActive(open ? group.name : undefined)}
              >
                {list}
              </Disclosure>
            )}
          </section>
        )
      })}
      {remaining.length ? (
        <section className={styles.group}>
          <Disclosure
            title={t("explore:hotelCard.amenityNotes")}
            icon="info"
            open={active === notesId}
            onOpenChange={(open) => setActive(open ? notesId : undefined)}
          >
            <div className={styles.notes}>
              {remaining.map((text) => (
                <p className={styles.description} key={text} lang="ru">
                  {text}
                </p>
              ))}
            </div>
          </Disclosure>
        </section>
      ) : null}
    </div>
  )
}

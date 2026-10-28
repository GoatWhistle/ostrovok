import { amenityGroupName, amenityName } from "@/entities/hotel"
import type { components } from "@/shared/api/schema.gen"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Disclosure } from "@/shared/ui"
import { DetailsSection } from "../details-section"
import { pickAmenities } from "./amenity-picks"
import styles from "./supplier.module.css"

type Group = components["schemas"]["SupplierAmenityGroup"]

function AllAmenities({ groups }: { readonly groups: readonly Group[] }) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  return (
    <div className={styles.allAmenities}>
      <div className={styles.groups}>
        {groups.map((group) => {
          const title = amenityGroupName(group.name, locale)
          return (
            <section key={group.name} className={styles.group}>
              <p className={styles.groupName} lang={title.lang}>
                {title.text}
              </p>
              <ul className={styles.items}>
                {group.amenities.map((item) => {
                  const name = amenityName(item.name, locale)
                  return (
                    <li key={item.name}>
                      <span lang={name.lang}>{name.text}</span>
                      {item.free ? (
                        <span className={styles.free}> · {t("explore:supplier.free")}</span>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>
      <p className={styles.note}>{t("explore:supplier.amenitiesNote")}</p>
    </div>
  )
}

export function SupplierAmenities({
  groups,
  pattern,
}: {
  readonly groups: readonly Group[]
  readonly pattern: RegExp | undefined
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const listed = groups.filter((group) => group.amenities.length)
  if (!listed.length) return null
  const total = listed.reduce((sum, group) => sum + group.amenities.length, 0)
  const top = pickAmenities(listed, pattern)
  return (
    <DetailsSection title={t("explore:supplier.amenities")}>
      {top.length ? (
        <ul className={styles.top}>
          {top.map((item) => {
            const name = amenityName(item.name, locale)
            return (
              <li key={item.name} lang={name.lang}>
                {name.text}
              </li>
            )
          })}
        </ul>
      ) : null}
      <Disclosure title={t("explore:supplier.allAmenities", { count: total })}>
        <AllAmenities groups={listed} />
      </Disclosure>
    </DetailsSection>
  )
}

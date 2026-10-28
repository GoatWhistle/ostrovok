import { amenityGroupName, amenityName } from "@/entities/hotel"
import type { components } from "@/shared/api/schema.gen"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Disclosure, Icon } from "@/shared/ui"
import styles from "./supplier.module.css"

type Group = components["schemas"]["SupplierAmenityGroup"]

export function SupplierAmenities({ groups }: { readonly groups: readonly Group[] }) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  if (!groups.length) return null
  const total = groups.reduce((sum, group) => sum + group.amenities.length, 0)
  return (
    <Disclosure title={t("explore:supplier.amenities", { count: total })} icon="check">
      <p className={styles.label}>{t("explore:supplier.amenitiesNote")}</p>
      <div className={styles.block}>
        {groups.map((group) => {
          const title = amenityGroupName(group.name, locale)
          return (
            <div key={group.name} className={styles.group}>
              <p className={styles.groupName} lang={title.lang}>
                {title.text}
              </p>
              <ul className={styles.items}>
                {group.amenities.map((item) => {
                  const name = amenityName(item.name, locale)
                  return (
                    <li key={item.name} className={styles.item} lang={name.lang}>
                      {item.free ? <Icon name="check" size="sm" /> : null}
                      {name.text}
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
    </Disclosure>
  )
}

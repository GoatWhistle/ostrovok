import type { components } from "@/shared/api/schema.gen"
import { useTranslation } from "@/shared/i18n"
import { Disclosure, Icon } from "@/shared/ui"
import styles from "./supplier.module.css"
import { SupplierAmenities } from "./supplier-amenities"
import { SupplierFacts } from "./supplier-facts"
import { SupplierNearby } from "./supplier-nearby"

type Details = components["schemas"]["SupplierDetails"]

export function SupplierDetails({
  details,
  source,
}: {
  readonly details: Details
  readonly source: string | null | undefined
}) {
  const { t } = useTranslation()
  return (
    <div className={styles.block}>
      <SupplierFacts facts={details.facts} />
      <SupplierAmenities groups={details.amenity_groups} />
      <SupplierNearby places={details.nearby} />
      {details.description.length ? (
        <Disclosure title={t("explore:supplier.about")} icon="info">
          <div className={styles.prose}>
            {details.description.map((section) => (
              <section key={section.title}>
                <p className={styles.proseTitle} lang="ru">
                  {section.title}
                </p>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} lang="ru">
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </Disclosure>
      ) : null}
      <a className={styles.link} href={details.page_url} target="_blank" rel="noreferrer noopener">
        <Icon name="source" size="sm" />
        {t("explore:supplier.page", { source: source ?? "" })}
      </a>
    </div>
  )
}

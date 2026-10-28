import type { components } from "@/shared/api/schema.gen"
import { useTranslation } from "@/shared/i18n"
import { Disclosure } from "@/shared/ui"
import { type DescriptionTopic, descriptionSections } from "./description-sections"
import { SupplierDescription } from "./supplier-description"
import styles from "./supplier-narrative.module.css"

export interface SupplierNarrativeProps {
  readonly sections: readonly components["schemas"]["SupplierDescriptionSection"][]
  readonly topic: DescriptionTopic
}

export function SupplierNarrative({ sections, topic }: SupplierNarrativeProps) {
  const { t } = useTranslation()
  const relevant = descriptionSections(sections, topic)
  if (!relevant.length) return null
  return (
    <div className={styles.narrative}>
      <Disclosure title={t("explore:hotelCard.supplierDescription")}>
        <SupplierDescription sections={relevant} pattern={undefined} heading={false} full />
      </Disclosure>
    </div>
  )
}

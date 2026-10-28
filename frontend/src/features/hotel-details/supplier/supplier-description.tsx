import { useId, useState } from "react"
import type { components } from "@/shared/api/schema.gen"
import { useTranslation } from "@/shared/i18n"
import { Button } from "@/shared/ui"
import { DetailsSection } from "../details-section/details-section"
import { leadText, plainSections } from "./description-text"
import { Highlighted } from "./highlighted"
import styles from "./supplier.module.css"

type Section = components["schemas"]["SupplierDescriptionSection"]

const SHORT_TEXT = 280

export function SupplierDescription({
  sections,
  pattern,
}: {
  readonly sections: readonly Section[]
  readonly pattern: RegExp | undefined
}) {
  const { t } = useTranslation()
  const id = useId()
  const [open, setOpen] = useState(false)
  const clean = plainSections(sections)
  if (!clean.length) return null
  const lead = leadText(clean, pattern)
  const long = lead.text.length > SHORT_TEXT || clean.length > 1
  return (
    <DetailsSection
      title={t("explore:supplier.about")}
      hint={lead.reordered && !open ? t("explore:supplier.aboutWish") : undefined}
    >
      <div id={id} className={styles.prose} lang="ru">
        {open || !long ? (
          clean.map((section) => (
            <section key={section.title} className={styles.proseSection}>
              {clean.length > 1 && section.title ? (
                <p className={styles.proseTitle}>{section.title}</p>
              ) : null}
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>
                  <Highlighted text={paragraph} pattern={pattern} />
                </p>
              ))}
            </section>
          ))
        ) : (
          <p className={styles.clamp}>
            <Highlighted text={lead.text} pattern={pattern} />
          </p>
        )}
      </div>
      {long ? (
        <Button
          variant="ghost"
          size="compact"
          className={styles.more}
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((value) => !value)}
        >
          {t(open ? "explore:supplier.showLess" : "explore:supplier.showMore")}
        </Button>
      ) : null}
    </DetailsSection>
  )
}

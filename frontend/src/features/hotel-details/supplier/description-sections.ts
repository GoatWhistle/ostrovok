import type { components } from "@/shared/api/schema.gen"
import { i18n } from "@/shared/i18n/instance"
import { plain } from "./description-text"

type Section = components["schemas"]["SupplierDescriptionSection"]
export type DescriptionTopic = "about" | "amenities" | "rooms"

function normalized(value: string): string {
  return plain(value).trim().toLocaleLowerCase().replace(/\s+/g, " ")
}

export function descriptionSections(
  sections: readonly Section[],
  topic: DescriptionTopic,
): Section[] {
  return sections.filter((section) => {
    const title = normalized(section.title)
    const match = (["nearby", "amenities", "rooms"] as const).find((kind) =>
      (["ru", "en"] as const)
        .flatMap((lng) =>
          i18n.t(`explore:hotelCard.descriptionTitles.${kind}`, { lng, returnObjects: true }),
        )
        .some((label) => normalized(label) === title),
    )
    return ((match === "nearby" ? "about" : match) ?? "about") === topic
  })
}

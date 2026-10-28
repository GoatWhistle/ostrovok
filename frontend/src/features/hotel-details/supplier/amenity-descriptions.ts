import type { components } from "@/shared/api/schema.gen"
import { descriptionSections } from "./description-sections"
import { plainSections } from "./description-text"

type Amenity = components["schemas"]["SupplierAmenity"]
type Group = components["schemas"]["SupplierAmenityGroup"]
type Section = components["schemas"]["SupplierDescriptionSection"]

function normalized(text: string): string {
  return text
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
}

function caption(sentence: string, name: string): string {
  if (!sentence.toLocaleLowerCase().startsWith(name.toLocaleLowerCase())) return sentence
  const rest = sentence.slice(name.length).replace(/^[\s:,.]+/, "")
  return rest ? rest.charAt(0).toLocaleUpperCase() + rest.slice(1) : ""
}

export function amenityDescriptions(groups: readonly Group[], sections: readonly Section[]) {
  const amenities = groups
    .flatMap((group) => group.amenities)
    .sort((a, b) => normalized(b.name).length - normalized(a.name).length)
  const descriptions = new Map<Amenity, string[]>()
  const remaining: string[] = []
  const relevant = plainSections(descriptionSections(sections, "amenities"))
  const sentences = relevant
    .flatMap((section) => section.paragraphs)
    .flatMap((paragraph) => paragraph.split(/(?<=[.!?…])\s+(?=[\p{Lu}\p{N}«"])/u))
  for (const sentence of new Set(sentences)) {
    const text = ` ${normalized(sentence)} `
    const item = amenities.find((amenity) => {
      const name = normalized(amenity.name)
      return name.length > 0 && text.includes(` ${name} `)
    })
    if (!item) {
      remaining.push(sentence)
      continue
    }
    const value = caption(sentence, item.name)
    if (value) descriptions.set(item, [...(descriptions.get(item) ?? []), value])
  }
  return { descriptions, remaining }
}

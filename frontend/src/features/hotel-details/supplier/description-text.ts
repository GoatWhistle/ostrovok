import type { components } from "@/shared/api/schema.gen"
import { mentions } from "./wish-terms"

type Section = components["schemas"]["SupplierDescriptionSection"]

export interface PlainSection {
  readonly title: string
  readonly paragraphs: readonly string[]
}

const ENTITIES: Readonly<Record<string, string>> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&quot;": '"',
  "&laquo;": "«",
  "&raquo;": "»",
  "&mdash;": String.fromCodePoint(0x2014),
  "&ndash;": String.fromCodePoint(0x2013),
  "&#39;": "'",
}

export function plain(text: string): string {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function plainSections(sections: readonly Section[]): PlainSection[] {
  return sections
    .map((section) => ({
      title: plain(section.title),
      paragraphs: section.paragraphs.map(plain).filter(Boolean),
    }))
    .filter((section) => section.paragraphs.length)
}

function sentences(paragraph: string): string[] {
  return paragraph.split(/(?<=[.!?…])\s+(?=[\p{Lu}\p{N}«"])/u).filter(Boolean)
}

export interface Lead {
  readonly text: string
  readonly reordered: boolean
}

export function leadText(sections: readonly PlainSection[], pattern: RegExp | undefined): Lead {
  const all = sections.flatMap((section) => section.paragraphs.flatMap(sentences))
  const relevant = all.filter((sentence) => mentions(sentence, pattern))
  const rest = all.filter((sentence) => !mentions(sentence, pattern))
  return {
    text: [...relevant, ...rest].join(" "),
    reordered: relevant.length > 0 && relevant.length < all.length,
  }
}

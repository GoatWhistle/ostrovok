import type { CSSProperties } from "react"
import type { components } from "@/shared/api/schema.gen"

export type ChatFilter = components["schemas"]["ChatFilter"]

export function filterId(filter: ChatFilter): string {
  if (filter.kind !== "wish") return filter.kind
  return `wish:${(filter.label ?? "").trim().toLocaleLowerCase()}`
}

export function wishFilter(label: string, key: string): ChatFilter {
  return { kind: "wish", label, key }
}

export function hasFilter(filters: readonly ChatFilter[], id: string): boolean {
  return filters.some((item) => filterId(item) === id)
}

export function withFilter(filters: readonly ChatFilter[], filter: ChatFilter): ChatFilter[] {
  const id = filterId(filter)
  return hasFilter(filters, id) ? [...filters] : [...filters, filter]
}

export function withoutFilter(filters: readonly ChatFilter[], id: string): ChatFilter[] {
  return filters.filter((item) => filterId(item) !== id)
}

export function filterName(id: string): CSSProperties {
  let hash = 0
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) | 0
  return { viewTransitionName: `filter-${(hash >>> 0).toString(36)}` }
}

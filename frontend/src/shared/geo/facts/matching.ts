import type { FactBrief, MatchedProperty } from "@/shared/api/hotel-types"

export function isCurrentFact(fact: FactBrief | null | undefined): boolean {
  return fact?.status === "active" || fact?.status === "confirmed_by_hotelier"
}
export function isUsableMatch(item: MatchedProperty): boolean {
  return (item.match === "full" || item.match === "partial") && isCurrentFact(item.fact)
}

export function isAvailableFact(fact: FactBrief): boolean {
  return isCurrentFact(fact) && fact.value !== null && fact.value !== undefined
}

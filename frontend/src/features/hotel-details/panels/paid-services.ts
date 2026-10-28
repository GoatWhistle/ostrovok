import type { Fact } from "@/shared/api/hotel-types"
import type { components } from "@/shared/api/schema.gen"
import { isAvailableFact } from "@/shared/geo/facts/matching"

type Conflict = components["schemas"]["Conflict"]

export interface PaidService {
  readonly fact: Fact
  readonly amount: number
}

export function paidServices(
  facts: readonly Fact[],
  conflicts: readonly Conflict[] = [],
): PaidService[] {
  return facts.flatMap((fact) => {
    if (fact.characteristic_key !== "pets_policy" || !isAvailableFact(fact)) return []
    if (!fact.subject?.startsWith("hotel:")) return []
    if (
      conflicts.some(
        (item) => item.resolution === "pending" && item.fact_ids.includes(fact.fact_id),
      )
    )
      return []
    const value = fact.value
    if (value === null || typeof value !== "object" || Array.isArray(value)) return []
    const record = value as Record<string, unknown>
    const amount = record.fee_rub
    if (
      record.allowed !== true ||
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      amount <= 0
    )
      return []
    return [{ fact, amount }]
  })
}

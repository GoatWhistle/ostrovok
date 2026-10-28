import { describe, expect, it } from "vitest"
import { paidServices } from "../../../../src/features/hotel-details/panels/paid-services"
import type { Fact } from "../../../../src/shared/api/hotel-types"

const fact: Fact = {
  fact_id: "pets",
  characteristic_key: "pets_policy",
  value: { allowed: true, fee_rub: 500 },
  label: "Pets",
  subject: "hotel:one",
  confidence: 1,
  source_type: "hotelier",
  status: "confirmed_by_hotelier",
}

describe("paid services", () => {
  it("uses positive confirmed hotel surcharges without inventing a charging period", () => {
    expect(paidServices([fact])).toEqual([{ fact, amount: 500 }])
  })

  it.each([
    { value: { allowed: true, fee_rub: 0 } },
    { value: { allowed: false, fee_rub: 500 } },
    { value: { fee_rub: 500 } },
    { value: { allowed: true, fee_rub: -100 } },
    { value: { allowed: true, fee_rub: "500" } },
    { value: { allowed: true, fee_rub: Number.NaN } },
    { status: "stale" as const },
    { status: "computing" as const },
    { subject: "room:one" },
    { characteristic_key: "distance_to_sea" },
  ])("does not claim an unconfirmed fee: %j", (patch) => {
    expect(paidServices([{ ...fact, ...patch }])).toEqual([])
  })

  it("does not publish a fee from an unresolved conflict", () => {
    expect(
      paidServices(
        [fact],
        [
          {
            id: "conflict",
            characteristic_key: "pets_policy",
            fact_ids: [fact.fact_id],
            resolution: "pending",
            rule: "hotelier",
          },
        ],
      ),
    ).toEqual([])
  })
})

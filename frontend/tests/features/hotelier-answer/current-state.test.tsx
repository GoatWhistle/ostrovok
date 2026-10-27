import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { expect, it } from "vitest"
import { CurrentState } from "@/features/hotelier-answer/current-state"
import { LocaleProvider } from "@/shared/i18n"
import { registryClient } from "./registry"

function height(id: string, value: number, status: string, at: string, confidence: number) {
  return {
    fact_id: id,
    characteristic_key: "building_height",
    value,
    unit: "m",
    label: `${value} m`,
    confidence,
    source_type: status === "confirmed_by_hotelier" ? "hotelier" : "osm",
    status,
    provenance: { source_type: "osm", confidence, computed_at: at },
  }
}

it("shows the hotelier's current value instead of a superseded or stale one", () => {
  const client = registryClient()
  client.setQueryData(["hotel", "h1"], {
    hotel: { id: "h1", name: "Hotel", location: [39.7, 43.6] },
    facts: [
      height("f_old", 12, "superseded", "2026-10-20T00:00:00Z", 1),
      height("f_stale", 13, "stale", "2026-10-26T00:00:00Z", 1),
      height("f_new", 15, "confirmed_by_hotelier", "2026-10-25T00:00:00Z", 0.9),
    ],
  })
  render(
    <QueryClientProvider client={client}>
      <LocaleProvider>
        <CurrentState hotelId="h1" characteristicKey="building_height" />
      </LocaleProvider>
    </QueryClientProvider>,
  )
  expect(screen.getByText(/15/)).toBeTruthy()
  expect(screen.queryByText(/12/)).toBeNull()
  expect(screen.queryByText(/13/)).toBeNull()
})

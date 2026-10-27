import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { HotelMatches } from "../../../src/entities/hotel/hotel-result/hotel-matches"
import { HotelStars } from "../../../src/entities/hotel/hotel-stars/hotel-stars"
import { HotelThumb } from "../../../src/entities/hotel/hotel-thumb/hotel-thumb"
import type { MatchedProperty } from "../../../src/shared/api/hotel-types"
import { petsLabel } from "../../../src/shared/geo/facts/pets"
import { LocaleProvider } from "../../../src/shared/i18n/locale-provider"
import ru from "../../../src/shared/i18n/locales/ru/explore.json"

function wish(key: string, match: MatchedProperty["match"], status = "active"): MatchedProperty {
  return {
    characteristic_key: key,
    label: key,
    match,
    fact: {
      fact_id: key,
      characteristic_key: key,
      label: key,
      value: true,
      confidence: 1,
      source_type: "computed",
      status: status as NonNullable<MatchedProperty["fact"]>["status"],
    },
  }
}
describe("hotel list evidence", () => {
  it("shows only usable full and partial matches while retaining the condition", () => {
    const onProperty = vi.fn()
    const partial = { ...wish("partial", "partial"), explanation: "Only from the fourth floor" }
    render(
      <LocaleProvider>
        <HotelMatches
          matched={[
            wish("found", "full"),
            partial,
            wish("missing", "none"),
            wish("unknown", "unknown"),
            wish("old", "full", "stale"),
            wish("conflict", "full", "conflicted"),
          ]}
          onProperty={onProperty}
          onPreview={vi.fn()}
        />
      </LocaleProvider>,
    )
    expect(screen.getAllByRole("button")).toHaveLength(2)
    expect(screen.getByText("Only from the fourth floor")).toBeTruthy()
    expect(screen.queryByText("old")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "found" }))
    expect(onProperty).toHaveBeenCalledOnce()
  })
  it("tries the next photo then removes the frame when all fail", () => {
    const { container } = render(
      <HotelThumb
        src="https://hotel.example/a.jpg"
        photos={[{ url: "https://hotel.example/b.jpg", kind: "hotel" }]}
      />,
    )
    fireEvent.error(container.querySelector("img") as HTMLImageElement)
    expect(container.querySelector("img")?.src).toContain("b.jpg")
    fireEvent.error(container.querySelector("img") as HTMLImageElement)
    expect(container.querySelector("[data-hotel-photo]")).toBeNull()
  })
  it("does not turn a review rating into a star category", () => {
    const { rerender } = render(<HotelStars value={4.7} />)
    expect(screen.queryByRole("img")).toBeNull()
    rerender(<HotelStars value={4} />)
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("4")
  })
  it("distinguishes forbidden, unknown, free and a fee without inventing a period", () => {
    expect(petsLabel({ allowed: false, fee_rub: 10 }, "ru")).not.toContain("10")
    expect(petsLabel({}, "ru")).not.toBe(petsLabel(false, "ru"))
    expect(petsLabel({ allowed: true, fee_rub: 0 }, "ru")).toContain(ru.cards.petsFree)
    expect(petsLabel({ allowed: true, fee_rub: 250 }, "ru")).toContain("250")
    expect(petsLabel({ allowed: true, fee_rub: 250 }, "en")).toContain("period")
  })
})

import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { HotelRating } from "../../../src/entities/hotel/hotel-rating/hotel-rating"
import { HotelStars } from "../../../src/entities/hotel/hotel-stars/hotel-stars"
import { HotelThumb } from "../../../src/entities/hotel/hotel-thumb/hotel-thumb"
import { MatchExplain } from "../../../src/entities/hotel/match-score/match-explain"
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
afterEach(() => {
  vi.unstubAllGlobals()
})

describe("hotel list evidence", () => {
  it("shows a plain score and explains every wish in words on demand", () => {
    const sea = wish("near_sea", "full")
    const fact = sea.fact as NonNullable<MatchedProperty["fact"]>
    const measured: MatchedProperty = {
      ...sea,
      label: "within walking distance of the sea",
      fact: {
        ...fact,
        qualifiers: { native_characteristic_key: "distance_to_sea", native_value: 3 },
      },
    }
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    )
    render(
      <LocaleProvider>
        <MatchExplain matched={[wish("unknown", "unknown"), measured]} confidence={0.95} />
      </LocaleProvider>,
    )
    expect(screen.getByText("1/2")).toBeTruthy()
    expect(screen.queryByText("within walking distance of the sea")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: ru.cards.whyMatch }))
    const items = screen.getAllByRole("listitem").map((item) => item.textContent)
    expect(items[0]).toContain("3")
    expect(items[1]).toBe(ru.cards.wishMissing.replace("{{text}}", "unknown"))
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
  it("keeps a quiet frame when a placeholder is requested and no photo loads", () => {
    const { container } = render(<HotelThumb src={null} extra={["not a url"]} placeholder />)
    expect(container.querySelector("img")).toBeNull()
    expect(container.querySelector("[data-hotel-photo] svg")).toBeTruthy()
  })
  it("shows a guest rating with its review count and hides an absent one", () => {
    const { container, rerender } = render(
      <LocaleProvider>
        <HotelRating score={undefined} reviews={0} />
      </LocaleProvider>,
    )
    expect(container.textContent).toBe("")
    rerender(
      <LocaleProvider>
        <HotelRating score={7.4} reviews={128} />
      </LocaleProvider>,
    )
    expect(container.textContent).toContain("128")
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("128")
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

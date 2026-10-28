import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { DetailsSection } from "../../../src/features/hotel-details/details-section/details-section"
import ru from "../../../src/shared/i18n/locales/ru/explore.json"

describe("collapsible hotel section", () => {
  it("starts closed and opens and closes its contents using the same heading", async () => {
    render(
      <DetailsSection title={ru.hotelCard.stayConditions} collapsible>
        <p>{ru.hotelCard.checkIn}</p>
      </DetailsSection>,
    )
    const trigger = screen.getByRole("button", { name: ru.hotelCard.stayConditions })
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    expect(screen.queryByText(ru.hotelCard.checkIn)).toBeNull()
    await userEvent.click(trigger)
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    expect(screen.getByText(ru.hotelCard.checkIn)).toBeTruthy()
    await userEvent.click(trigger)
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    await waitFor(() => expect(screen.queryByText(ru.hotelCard.checkIn)).toBeNull())
  })
})

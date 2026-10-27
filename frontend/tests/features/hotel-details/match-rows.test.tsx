import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MatchRows } from "../../../src/features/hotel-details/matches/match-rows"
import type { MatchedProperty } from "../../../src/shared/api/hotel-types"
import { LocaleProvider } from "../../../src/shared/i18n/locale-provider"
import ru from "../../../src/shared/i18n/locales/ru/explore.json"

function match(key: string, status: "active" | "stale" = "active"): MatchedProperty {
  return {
    characteristic_key: key,
    label: key,
    match: "full",
    fact: {
      fact_id: key,
      characteristic_key: key,
      label: key,
      value: true,
      confidence: 1,
      source_type: "computed",
      status,
    },
  }
}
describe("hotel wish details", () => {
  it("shows three current matches first and discloses other wishes with honest status", () => {
    const onFact = vi.fn()
    render(
      <LocaleProvider>
        <MatchRows
          matched={[
            match("old", "stale"),
            match("first"),
            match("second"),
            match("third"),
            match("fourth"),
          ]}
          onFact={onFact}
          onProperty={undefined}
          onPreview={undefined}
        />
      </LocaleProvider>,
    )
    expect(screen.queryByRole("button", { name: /old/ })).toBeNull()
    expect(screen.queryByRole("button", { name: /fourth/ })).toBeNull()
    fireEvent.click(
      screen.getByRole("button", { name: ru.cards.moreWishes.replace("{{count}}", "2") }),
    )
    const stale = screen.getByRole("button", { name: /old/ })
    expect(stale.textContent).toContain(ru.status.stale)
    expect(stale.textContent).not.toContain(ru.match.full)
    fireEvent.click(screen.getByRole("button", { name: /fourth/ }))
    expect(onFact).toHaveBeenCalledWith(expect.objectContaining({ fact_id: "fourth" }))
  })
})

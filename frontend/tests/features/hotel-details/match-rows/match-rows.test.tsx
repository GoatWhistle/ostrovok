import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MatchRows } from "../../../../src/features/hotel-details/match-rows/match-rows"
import type { MatchedProperty } from "../../../../src/shared/api/hotel-types"
import { LocaleProvider } from "../../../../src/shared/i18n/locale-provider"
import ru from "../../../../src/shared/i18n/locales/ru/explore.json"

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

function derived(
  label: string,
  qualifiers: Record<string, unknown>,
  state: MatchedProperty["match"] = "full",
): MatchedProperty {
  return {
    characteristic_key: `derived:${label}`,
    label,
    match: state,
    explanation: "method note",
    fact: {
      fact_id: label,
      characteristic_key: `derived:${label}`,
      label,
      value: state === "unknown" ? null : true,
      confidence: 0.8,
      source_type: "computed",
      status: "active",
      qualifiers,
    },
  }
}

describe("wish verdicts", () => {
  it("replaces the wish label with a short answer and hides method notes", () => {
    render(
      <LocaleProvider>
        <MatchRows
          matched={[
            derived("by the sea", {
              native_characteristic_key: "distance_to_sea",
              native_value: 3,
              meters: 242.6,
            }),
            derived("quiet", { native_characteristic_key: "noise_level", native_value: 1.8 }),
            derived("with a dog", { wish_status: "incomplete" }, "unknown"),
          ]}
          onFact={vi.fn()}
          onProperty={undefined}
          onPreview={undefined}
        />
      </LocaleProvider>,
    )
    const walk = ru.wish.sea.replace("{{minutes}}", "3")
    expect(
      screen.getByText(ru.wish.seaMeters.replace("{{walk}}", walk).replace("{{value}}", "240")),
    ).toBeTruthy()
    expect(screen.getByText(ru.wish.quiet.replace("{{score}}", "1,8"))).toBeTruthy()
    fireEvent.click(
      screen.getByRole("button", { name: ru.cards.moreWishes.replace("{{count}}", "1") }),
    )
    expect(screen.getByText(ru.wish.incomplete)).toBeTruthy()
    expect(screen.queryAllByText("method note")).toHaveLength(0)
    expect(screen.queryByText("quiet")).toBeNull()
  })
})

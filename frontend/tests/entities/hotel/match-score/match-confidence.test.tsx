import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { MatchConfidence } from "../../../../src/entities/hotel/match-score/match-score"
import { LocaleProvider } from "../../../../src/shared/i18n/locale-provider"

function show(value: number | undefined) {
  return render(
    <LocaleProvider>
      <MatchConfidence value={value} />
    </LocaleProvider>,
  ).container
}

describe("match confidence", () => {
  it("stays hidden when the search is confident", () => {
    expect(show(0.92).textContent).toBe("")
    expect(show(undefined).textContent).toBe("")
  })

  it("shows a low confidence as a percent", () => {
    expect(show(0.55).textContent).toMatch(/55\s?%/)
  })
})

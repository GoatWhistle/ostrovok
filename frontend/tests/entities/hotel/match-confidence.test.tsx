import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { MatchConfidence } from "../../../src/entities/hotel"
import { LocaleProvider } from "../../../src/shared/i18n/locale-provider"

function show(value: number | undefined) {
  return render(
    <LocaleProvider>
      <MatchConfidence value={value} />
    </LocaleProvider>,
  )
}

describe("MatchConfidence", () => {
  it("shows a known confidence as a percentage", () => {
    show(0.74)

    expect(screen.getByText(/74/)).not.toBeNull()
  })

  it("stays silent when confidence is unknown or zero", () => {
    expect(show(undefined).container.textContent).toBe("")
    expect(show(0).container.textContent).toBe("")
  })
})

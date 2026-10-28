import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { FactProvenance } from "../../../src/features/fact-details/fact-provenance/fact-provenance"
import type { components } from "../../../src/shared/api/schema.gen"
import { createI18n, LocaleProvider } from "../../../src/shared/i18n"
import ru from "../../../src/shared/i18n/locales/ru/explore.json"

const provenance: components["schemas"]["Provenance"] = {
  source_type: "computed",
  confidence: 0.6,
  computed_at: "2026-10-26T12:00:00Z",
  valid_until: "2027-04-24T12:00:00Z",
  observed_at: null,
  method: "noise_level@1",
}

function show(confidence = 0.6) {
  return render(
    <LocaleProvider instance={createI18n("ru")}>
      <FactProvenance
        provenance={provenance}
        conflicts={[]}
        fact={{ source_type: "computed", confidence }}
      />
    </LocaleProvider>,
  )
}

describe("fact provenance", () => {
  it("omits repeated summary values and absent observation dates", () => {
    const { container } = show()
    expect(screen.queryByText(ru.details.source)).toBeNull()
    expect(screen.queryByText(ru.details.confidence)).toBeNull()
    expect(screen.queryByText(ru.details.observed)).toBeNull()
    expect(container.querySelectorAll("time")).toHaveLength(2)
    expect(screen.getByText(ru.details.validUntil)).toBeTruthy()
  })

  it("keeps the method available behind technical details", async () => {
    show()
    expect(screen.queryByText("noise_level@1")).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: ru.details.technical }))
    expect(screen.getByText("noise_level@1")).toBeTruthy()
  })

  it("retains the source confidence when the current fact confidence differs", () => {
    show(0.3)
    expect(screen.getByText(ru.details.sourceConfidence)).toBeTruthy()
  })
})

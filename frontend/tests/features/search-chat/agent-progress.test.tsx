import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { AgentProgress } from "../../../src/features/search-chat/progress/agent-progress"
import { createI18n, LocaleProvider } from "../../../src/shared/i18n"
import ru from "../../../src/shared/i18n/locales/ru/explore.json"

function show(events: Parameters<typeof AgentProgress>[0]["events"]) {
  return render(
    <LocaleProvider instance={createI18n("ru")}>
      <ol>
        <AgentProgress events={events} />
      </ol>
    </LocaleProvider>,
  )
}

describe("agent progress", () => {
  it("names the current step and keeps a skeleton until the request is understood", () => {
    const { container } = show([])
    expect(screen.getByRole("status").textContent).toBe(ru.chat.progress.step.parse)
    expect(screen.queryByText(ru.chat.understood)).toBeNull()
    expect(container.querySelectorAll("[data-state='current']")).toHaveLength(1)
  })

  it("shows understood wishes with their verdicts", () => {
    show([
      { stage: "parsed", location: "Sochi", intents: [{ term: "quiet", key: "noise_level" }] },
      { stage: "research", wishes: 1 },
      { stage: "wish", term: "quiet", status: "matched" },
    ])
    expect(screen.getByRole("status").textContent).toBe(ru.chat.progress.step.wishes)
    expect(screen.getByText(ru.chat.understood)).toBeTruthy()
    expect(screen.getByText("Sochi")).toBeTruthy()
    expect(screen.getByText("quiet")).toBeTruthy()
    expect(screen.getByText(ru.chat.progress.wish.verified)).toBeTruthy()
  })
})

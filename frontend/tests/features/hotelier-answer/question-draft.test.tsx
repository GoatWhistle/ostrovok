import { QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { QuestionAnswer } from "@/features/hotelier-answer/question-answer"
import { LocaleProvider } from "@/shared/i18n"
import copy from "@/shared/i18n/locales/ru/explore.json"
import { registryClient } from "./registry"

vi.mock("@/features/hotelier-answer/current-state", () => ({ CurrentState: () => null }))

function question(id: string) {
  return {
    id,
    hotel_id: "h_draft",
    characteristic_key: "double_room",
    text: "Rooms?",
    reason: "missing" as const,
    status: "open" as const,
    created_at: "2026-10-27T00:00:00Z",
  }
}

beforeEach(() => sessionStorage.clear())

describe("hotel question drafts", () => {
  it("restores the original draft after switching questions and remounting", () => {
    const client = registryClient()
    function Form({ id }: { readonly id: string }) {
      return (
        <QueryClientProvider client={client}>
          <LocaleProvider>
            <QuestionAnswer key={id} hotelId="h_draft" question={question(id)} onSkip={undefined} />
          </LocaleProvider>
        </QueryClientProvider>
      )
    }
    const view = render(<Form id="q_a" />)
    const field = () =>
      screen.getByRole("textbox", { name: copy.answerFields.note }) as HTMLTextAreaElement
    fireEvent.change(field(), { target: { value: "A room with conditions" } })
    view.rerender(<Form id="q_b" />)
    expect(field().value).toBe("")
    fireEvent.change(field(), { target: { value: "Different room" } })
    view.rerender(<Form id="q_a" />)
    expect(field().value).toBe("A room with conditions")
    view.unmount()
    render(<Form id="q_b" />)
    expect(field().value).toBe("Different room")
  })
})

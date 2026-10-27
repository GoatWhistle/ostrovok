import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { QuestionAnswer } from "@/features/hotelier-answer/question-answer"
import { api } from "@/shared/api"
import { LocaleProvider } from "@/shared/i18n"
import copy from "@/shared/i18n/locales/ru/explore.json"
import { registryClient } from "./registry"

vi.mock("@/features/hotelier-answer/current-state", () => ({ CurrentState: () => null }))

let sequence = 0

function mount(key: string) {
  sequence += 1
  const question = {
    id: `q_${key}_${sequence}`,
    hotel_id: "h_typed",
    characteristic_key: key,
    text: "?",
    reason: "missing" as const,
    status: "open" as const,
    created_at: "2026-10-27T00:00:00Z",
  }
  render(
    <QueryClientProvider client={registryClient()}>
      <LocaleProvider>
        <QuestionAnswer hotelId="h_typed" question={question} onSkip={undefined} />
      </LocaleProvider>
    </QueryClientProvider>,
  )
}

function answered() {
  return vi.spyOn(api, "POST").mockResolvedValue({
    data: { question_id: "q", extracted: [], conflicts: [] },
    response: new Response("{}"),
  } as never)
}

const fields = copy.answerFields
const weightLabel = `${fields.max_weight_kg.label}, ${fields.max_weight_kg.unit}`
const feeLabel = `${fields.fee_rub.label}, ${fields.fee_rub.unit}`
const filled = (template: string, value: string) => template.replace("{{value}}", value)
const sentence = (text: string) => `${text.charAt(0).toLocaleUpperCase()}${text.slice(1)}.`

const send = () => screen.getByRole("button", { name: copy.hotelier.send })
const preview = () => screen.getByText(copy.answerFields.preview).nextElementSibling?.textContent

beforeEach(() => {
  vi.restoreAllMocks()
  sessionStorage.clear()
})

describe("typed hotelier answers", () => {
  it("lets a choice fill the answer without sending it", async () => {
    const post = answered()
    mount("double_room")
    expect(send().hasAttribute("disabled")).toBe(true)
    await userEvent.click(screen.getByRole("radio", { name: copy.answerFields.present.yes }))
    expect(post).not.toHaveBeenCalled()
    expect(preview()).toBe(sentence(fields.present.yesText))
    await userEvent.click(send())
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    expect(post.mock.calls[0]?.[1]).toMatchObject({
      body: { text: sentence(fields.present.yesText) },
    })
  })

  it("sends pet conditions together without inventing a payment period", async () => {
    const post = answered()
    mount("pets_policy")
    expect(screen.queryByRole("textbox", { name: weightLabel })).toBeNull()
    await userEvent.click(screen.getByRole("radio", { name: copy.answerFields.allowed.yes }))
    await userEvent.type(screen.getByRole("textbox", { name: weightLabel }), "10")
    await userEvent.type(screen.getByRole("textbox", { name: feeLabel }), "500")
    await userEvent.type(screen.getByRole("textbox", { name: copy.answerFields.note }), "Dogs only")
    expect(post).not.toHaveBeenCalled()
    await userEvent.click(send())
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    expect(post.mock.calls[0]?.[1]).toMatchObject({
      body: {
        text: [
          sentence(fields.allowed.yesText),
          sentence(filled(fields.max_weight_kg.text, "10")),
          sentence(filled(fields.fee_rub.text, "500")),
          "Dogs only",
        ].join(" "),
      },
    })
  })

  it("drops conditions when pets are refused and keeps unknown separate", async () => {
    mount("pets_policy")
    await userEvent.click(screen.getByRole("radio", { name: copy.answerFields.allowed.yes }))
    await userEvent.type(screen.getByRole("textbox", { name: feeLabel }), "500")
    await userEvent.click(screen.getByRole("radio", { name: copy.answerFields.allowed.no }))
    expect(screen.queryByRole("textbox", { name: feeLabel })).toBeNull()
    expect(preview()).toBe(sentence(fields.allowed.noText))
    await userEvent.click(screen.getByRole("radio", { name: copy.answerFields.unknown }))
    expect(preview()).toBe(copy.answerFields.previewEmpty)
    expect(send().hasAttribute("disabled")).toBe(true)
  })

  it("keeps a malformed number out of the request and explains it at the field", async () => {
    const post = answered()
    mount("room_capacity")
    const field = screen.getByRole("textbox", { name: copy.answerFields.adults.label })
    await userEvent.type(field, "1,2.3")
    expect(send().hasAttribute("disabled")).toBe(false)
    await userEvent.click(send())
    expect(post).not.toHaveBeenCalled()
    expect(field.getAttribute("aria-invalid")).toBe("true")
    expect(screen.getByRole("alert").textContent).toBe(copy.answerFields.invalidNumber)
    expect(document.activeElement).toBe(field)
    await userEvent.clear(field)
    await userEvent.type(field, "4")
    await userEvent.click(send())
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    expect(post.mock.calls[0]?.[1]).toMatchObject({
      body: { text: sentence(filled(fields.adults.text, "4")) },
    })
  })
})

import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { HotelierAnswer } from "@/features/hotelier-answer"
import { api } from "@/shared/api"
import { LocaleProvider } from "@/shared/i18n"
import copy from "@/shared/i18n/locales/ru/explore.json"
import { hotelierServer, type ServerQuestion } from "./hotelier-server"
import { registryClient } from "./registry"

vi.mock("@/features/hotelier-answer/current-state", () => ({ CurrentState: () => null }))

let sequence = 0
const h = copy.hotelier
const savedTitle = new RegExp(h.savedAt.replace("{{date}}", ".+"))

function questionSet(...statuses: ServerQuestion["status"][]): ServerQuestion[] {
  sequence += 1
  return statuses.map((status, index) => ({
    id: `q${sequence}_${index}`,
    characteristic_key: "double_room",
    status,
  }))
}

function mount(onEditFact = vi.fn()) {
  render(
    <MemoryRouter>
      <QueryClientProvider client={registryClient()}>
        <LocaleProvider>
          <HotelierAnswer hotelId="h1" onEditFact={onEditFact} />
        </LocaleProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
  return onEditFact
}

async function answerYes() {
  await userEvent.click(await screen.findByRole("radio", { name: copy.answerFields.present.yes }))
  await userEvent.click(screen.getByRole("button", { name: h.send }))
}

const queue = () => screen.getByRole("complementary", { name: h.queue })
const tab = (key: "open" | "skipped" | "answered", count: number) =>
  screen.getByRole("radio", { name: `${h.tabs[key]}: ${count}` })

beforeEach(() => {
  vi.restoreAllMocks()
  sessionStorage.clear()
})

describe("hotelier answer outcomes", () => {
  it.each([
    ["automatically", false],
    ["manually", true],
  ])("keeps the %s chosen question on screen with the saved value", async (_mode, manual) => {
    const questions = questionSet("open", "open")
    hotelierServer(questions)
    const edit = mount()
    if (manual) {
      const [first] = await within(queue()).findAllByRole("listitem")
      await userEvent.click(within(first as HTMLElement).getByRole("button"))
    }
    await answerYes()
    const saved = await screen.findByText(savedTitle)
    expect(saved.closest("[data-saved-answer]")?.getAttribute("data-saved-answer")).toBe(
      questions[0]?.id,
    )
    await userEvent.click(await screen.findByRole("button", { name: h.edit }))
    expect(edit).toHaveBeenCalledWith(`f_${questions[0]?.id}_0`)
    expect(tab("answered", 1)).toBeTruthy()
    await userEvent.click(screen.getByRole("button", { name: h.next }))
    expect(screen.getByText("Question 2", { selector: "p" })).toBeTruthy()
  })

  it("keeps a follow-up in the form with the sent answer", async () => {
    const questions = questionSet("open")
    hotelierServer(questions, { followUp: true })
    mount()
    await answerYes()
    expect(await screen.findByText("More details?")).toBeTruthy()
    expect(screen.getByText(h.previousAnswer)).toBeTruthy()
    expect(screen.queryByText(savedTitle)).toBeNull()
    expect(
      (screen.getByRole("radio", { name: copy.answerFields.present.yes }) as HTMLInputElement)
        .checked,
    ).toBe(true)
  })

  it("does not show a conflicting answer as a plain success", async () => {
    hotelierServer(questionSet("open"), { conflict: true })
    mount()
    await answerYes()
    expect(await screen.findByText(h.savedConflict)).toBeTruthy()
  })

  it("keeps the draft and marks the queue after a failed save", async () => {
    hotelierServer(questionSet("open", "open"), { fail: true })
    mount()
    await answerYes()
    expect(await screen.findByText(h.failed)).toBeTruthy()
    expect(within(queue()).getByText(h.queueError)).toBeTruthy()
    expect(
      (screen.getByRole("radio", { name: copy.answerFields.present.yes }) as HTMLInputElement)
        .checked,
    ).toBe(true)
  })
})

describe("deferred questions", () => {
  it("defers on the server and returns the question to work", async () => {
    const questions = questionSet("open")
    const calls = hotelierServer(questions)
    mount()
    await userEvent.click(await screen.findByRole("button", { name: h.skip }))
    expect(await screen.findByText(h.skippedTitle)).toBeTruthy()
    expect(calls.statuses).toEqual(["skipped"])
    await waitFor(() => expect(tab("skipped", 1)).toBeTruthy())
    await userEvent.click(screen.getByRole("button", { name: h.reopen }))
    expect(await screen.findByRole("button", { name: h.send })).toBeTruthy()
    expect(calls.statuses).toEqual(["skipped", "open"])
    expect(calls.answers).toEqual([])
  })
})

describe("one action per question", () => {
  it("blocks deferral while the answer is being saved", async () => {
    const calls = hotelierServer(questionSet("open"))
    vi.spyOn(api, "POST").mockImplementation(() => new Promise(() => {}))
    mount()
    await answerYes()
    const defer = screen.getByRole("button", { name: h.skip })
    expect(defer.hasAttribute("disabled")).toBe(true)
    await userEvent.click(defer)
    expect(calls.statuses).toEqual([])
  })
})

describe("queue states", () => {
  it("offers no next step for a single question", async () => {
    hotelierServer(questionSet("open"))
    mount()
    await screen.findByRole("button", { name: h.send })
    expect(screen.queryByRole("button", { name: h.next })).toBeNull()
  })

  it("reports a fully answered queue and an old answer without a fact link", async () => {
    const questions = questionSet("answered")
    Object.assign(questions[0] ?? {}, { answer_text: "Old answer", answer_fact_ids: [] })
    hotelierServer(questions)
    mount()
    expect(await screen.findByText(h.allAnswered)).toBeTruthy()
    expect(screen.getByText(h.allAnsweredText)).toBeTruthy()
    expect(screen.getByText("Old answer")).toBeTruthy()
    expect(screen.getByText(h.noLink)).toBeTruthy()
    expect(screen.queryByRole("button", { name: h.edit })).toBeNull()
    expect(within(queue()).queryByText(h.reason.missing)).toBeNull()
  })
})

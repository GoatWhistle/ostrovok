import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { HotelierPage } from "@/pages/hotelier/hotelier-page"
import { LocaleProvider } from "@/shared/i18n"
import common from "@/shared/i18n/locales/ru/common.json"
import copy from "@/shared/i18n/locales/ru/explore.json"
import { hotelierServer } from "../../features/hotelier-answer/hotelier-server"
import { registryClient } from "../../features/hotelier-answer/registry"

const h = copy.hotelier

function narrowScreen(narrow: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: narrow && query.includes("max-width"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
}

function mount() {
  hotelierServer([
    { id: "q_room", characteristic_key: "double_room", status: "open" },
    { id: "q_pets", characteristic_key: "pets_policy", status: "open" },
  ])
  render(
    <MemoryRouter initialEntries={["/hotelier/h1"]}>
      <QueryClientProvider client={registryClient()}>
        <LocaleProvider>
          <Routes>
            <Route path="/hotelier/:hotelId" element={<HotelierPage />} />
          </Routes>
        </LocaleProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
  sessionStorage.clear()
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "")
  }
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.removeAttribute("open")
  }
  HTMLElement.prototype.scrollIntoView ??= () => undefined
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("hotelier workspace", () => {
  it("shows one hotel header, short topics and no booking form", async () => {
    narrowScreen(false)
    mount()
    expect(await screen.findByRole("heading", { name: "Seaside test hotel" })).toBeTruthy()
    const queue = screen.getByRole("complementary", { name: h.queue })
    expect(await within(queue).findByText(copy.facts.titleDoubleRoom)).toBeTruthy()
    expect(within(queue).queryByText("Question 1")).toBeNull()
    expect(screen.getByText("Question 1", { selector: "p" })).toBeTruthy()
    expect(document.querySelector("input[type='date']")).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: h.change }))
    expect(screen.getByRole("textbox", { name: h.hotelId })).toBeTruthy()
  })

  it("opens the guest view without losing the answer in progress", async () => {
    narrowScreen(false)
    mount()
    const note = await screen.findByRole("textbox", { name: copy.answerFields.note })
    await userEvent.type(note, "Two rooms")
    const trigger = screen.getByRole("button", { name: h.preview })
    await userEvent.click(trigger)
    const dialog = await screen.findByRole("dialog", { name: h.preview })
    expect(within(dialog).getByText("Seaside test hotel")).toBeTruthy()
    await userEvent.click(within(dialog).getByRole("button", { name: common.action.close }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(document.activeElement).toBe(trigger)
    expect(
      (screen.getByRole("textbox", { name: copy.answerFields.note }) as HTMLTextAreaElement).value,
    ).toBe("Two rooms")
  })

  it("puts the question first on a phone and returns from the full queue", async () => {
    narrowScreen(true)
    mount()
    const all = await screen.findByRole("button", {
      name: h.allQuestions.replace("{{count}}", "2"),
    })
    expect(screen.getByText("Question 1", { selector: "p" })).toBeTruthy()
    await userEvent.click(all)
    const queue = screen.getByRole("complementary", { name: h.queue })
    const [, second] = within(queue).getAllByRole("listitem")
    await userEvent.click(within(second as HTMLElement).getByRole("button"))
    const heading = await screen.findByText("Question 2", { selector: "p" })
    expect(document.activeElement).toBe(heading)
  })
})

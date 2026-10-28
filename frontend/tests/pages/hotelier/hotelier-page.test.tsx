import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { HotelierPage } from "@/pages/hotelier/hotelier-page"
import { clearSessionDraft, readSessionDraft } from "@/shared/hooks/session-draft"
import { LocaleProvider } from "@/shared/i18n"
import common from "@/shared/i18n/locales/ru/common.json"
import copy from "@/shared/i18n/locales/ru/explore.json"
import { hotelierServer } from "../../features/hotelier-answer/hotelier-server"
import { CHARACTERISTICS, registryClient } from "../../features/hotelier-answer/registry"

const h = copy.hotelier

function narrowScreen(narrow: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: narrow && query.includes("max-width"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
}

function mount(fail = false, roomScope = false) {
  const client = registryClient()
  if (roomScope)
    client.setQueryData(["characteristics"], {
      items: CHARACTERISTICS.items.map((item) => ({ ...item, scope: "room" })),
    })
  const calls = hotelierServer(
    [
      { id: "q_room", characteristic_key: "double_room", status: "open" },
      { id: "q_pets", characteristic_key: "pets_policy", status: "open" },
      { id: "q_capacity", characteristic_key: "room_capacity", status: "open" },
    ],
    { extracted: 1, fail },
  )
  render(
    <MemoryRouter initialEntries={["/hotelier/h1"]}>
      <QueryClientProvider client={client}>
        <LocaleProvider>
          <Routes>
            <Route path="/hotelier/:hotelId" element={<HotelierPage />} />
          </Routes>
        </LocaleProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
  return calls
}

beforeEach(() => {
  vi.restoreAllMocks()
  sessionStorage.clear()
  for (const id of ["q_room", "q_pets", "q_capacity"]) {
    const key = `question:h1:${id}`
    clearSessionDraft(key, readSessionDraft(key).value)
  }
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
  it("shows owner-answerable room questions in the queue", async () => {
    mount(false, true)
    const queue = await screen.findByRole("complementary", { name: h.queue })
    expect(within(queue).getByText(copy.facts.titleDoubleRoom)).toBeTruthy()
  })

  it("shows one hotel header, short topics and no booking form", async () => {
    narrowScreen(false)
    mount()
    expect(await screen.findByRole("heading", { name: "Seaside test hotel" })).toBeTruthy()
    const queue = screen.getByRole("complementary", { name: h.queue })
    expect(await within(queue).findByText(copy.facts.titleDoubleRoom)).toBeTruthy()
    expect(within(queue).queryByText("Question 1")).toBeNull()
    expect(screen.getByRole("heading", { name: copy.workspace.askDouble })).toBeTruthy()
    expect(document.querySelector("input[type='date']")).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: h.change }))
    expect(screen.getByRole("textbox", { name: h.hotelId })).toBeTruthy()
  })

  it("opens the guest view without losing the answer in progress", async () => {
    narrowScreen(false)
    mount()
    await userEvent.click(await screen.findByText(copy.facts.titlePets))
    await userEvent.click(screen.getByRole("switch", { name: copy.answerFields.allowed.label }))
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

  it("turns a switch off and excludes dependent fields from the answer", async () => {
    const calls = mount()
    await userEvent.click(await screen.findByText(copy.facts.titlePets))
    const allowed = screen.getByRole("switch", { name: copy.answerFields.allowed.label })
    await userEvent.click(allowed)
    const note = screen.getByRole("textbox", { name: copy.answerFields.note })
    await userEvent.type(note, "Dogs only")
    expect(screen.getAllByRole("textbox")).toHaveLength(3)
    await userEvent.click(allowed)
    expect((allowed as HTMLInputElement).checked).toBe(false)
    expect(screen.queryByRole("textbox")).toBeNull()
    expect(
      screen.getByRole("button", { name: copy.workspace.saveNext }).hasAttribute("disabled"),
    ).toBe(false)
    await userEvent.click(screen.getByRole("button", { name: copy.workspace.saveNext }))
    const phrase = copy.answerFields.allowed.noText
    await waitFor(() =>
      expect(calls.answers).toEqual([`${phrase.charAt(0).toLocaleUpperCase()}${phrase.slice(1)}.`]),
    )
  })

  it("saves a boolean answer directly from the data row", async () => {
    const calls = mount()
    await screen.findByRole("heading", { name: copy.workspace.askDouble })
    await userEvent.click(screen.getByRole("tab", { name: copy.workspace.data }))
    const toggle = await screen.findByRole("switch", { name: copy.facts.titleDoubleRoom })
    expect(screen.queryByRole("heading", { name: copy.workspace.askDouble })).toBeNull()
    await userEvent.click(toggle)
    await waitFor(() => expect(calls.answers).toHaveLength(1))
    const phrase = copy.answerFields.present.yesText
    expect(calls.answers[0]).toBe(`${phrase.charAt(0).toLocaleUpperCase()}${phrase.slice(1)}.`)
  })

  it("restores a row switch after a failed save", async () => {
    mount(true)
    await screen.findByRole("heading", { name: copy.workspace.askDouble })
    await userEvent.click(screen.getByRole("tab", { name: copy.workspace.data }))
    const toggle = await screen.findByRole("switch", { name: copy.facts.titleDoubleRoom })
    await userEvent.click(toggle)
    expect(await screen.findByText(copy.workspace.saveFailed)).toBeTruthy()
    expect((toggle as HTMLInputElement).checked).toBe(false)
  })

  it("opens pet conditions inside their row without moving the list", async () => {
    const calls = mount()
    await screen.findByRole("heading", { name: copy.workspace.askDouble })
    await userEvent.click(screen.getByRole("tab", { name: copy.workspace.data }))
    const row = screen.getByRole("group", { name: copy.facts.titlePets })
    const toggle = within(row).getByRole("switch", { name: copy.facts.titlePets })
    await userEvent.click(toggle)
    expect(within(row).getAllByRole("switch")).toHaveLength(1)
    const note = within(row).getByRole("textbox", { name: copy.answerFields.note })
    await userEvent.type(note, "Dogs only")
    const capacity = screen.getByRole("group", { name: copy.facts.titleRoomCapacity })
    expect(row.compareDocumentPosition(capacity) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(calls.answers).toHaveLength(0)
    await userEvent.click(toggle)
    expect(within(row).queryByRole("textbox")).toBeNull()
    await waitFor(() => expect(calls.answers).toHaveLength(1))
    expect(calls.answers[0]).not.toContain("Dogs only")
  })

  it("uses a whole-number answer without an unrelated text field", async () => {
    const calls = mount()
    await userEvent.click(await screen.findByText(copy.facts.titleRoomCapacity))
    const input = screen.getByRole("textbox", { name: copy.answerFields.adults.label })
    expect(screen.queryByRole("textbox", { name: copy.answerFields.note })).toBeNull()
    const save = screen.getByRole("button", { name: copy.workspace.saveNext })
    expect(save.hasAttribute("disabled")).toBe(true)
    await userEvent.type(input, "2.5")
    await userEvent.tab()
    expect(screen.getByRole("alert").textContent).toContain(copy.answerFields.invalidCount)
    expect(save.hasAttribute("disabled")).toBe(true)
    await userEvent.clear(input)
    await userEvent.type(input, "3")
    await userEvent.click(
      screen.getByRole("button", {
        name: copy.answerFields.increase.replace("{{label}}", copy.answerFields.adults.label),
      }),
    )
    await userEvent.click(save)
    const phrase = copy.answerFields.adults.text.replace("{{value}}", "4")
    await waitFor(() =>
      expect(calls.answers).toEqual([`${phrase.charAt(0).toLocaleUpperCase()}${phrase.slice(1)}.`]),
    )
  })

  it("removes a saved answer from the queue and keeps it in hotel data", async () => {
    narrowScreen(false)
    mount()
    await userEvent.click(
      await screen.findByRole("switch", { name: copy.answerFields.present.label }),
    )
    await userEvent.click(screen.getByRole("button", { name: copy.workspace.saveNext }))
    const queue = screen.getByRole("complementary", { name: h.queue })
    await waitFor(() => expect(within(queue).queryByText(copy.facts.titleDoubleRoom)).toBeNull())
    expect(screen.getByRole("heading", { name: copy.workspace.askPets })).toBeTruthy()
    await userEvent.click(screen.getByRole("tab", { name: copy.workspace.data }))
    expect(await screen.findByText(copy.facts.titleDoubleRoom, { selector: "strong" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: h.skip })).toBeNull()
  })
})

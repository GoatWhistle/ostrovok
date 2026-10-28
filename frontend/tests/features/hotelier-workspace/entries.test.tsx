import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { beforeEach, expect, it, vi } from "vitest"
import { HotelierData } from "@/features/hotelier-workspace/hotelier-data"
import { api } from "@/shared/api"
import { LocaleProvider } from "@/shared/i18n"
import copy from "@/shared/i18n/locales/ru/explore.json"

const w = copy.workspace
const entries: { id: string; hotel_id: string; title: string; description: string }[] = []
let fail = false
let writes: string[] = []

beforeEach(() => {
  vi.restoreAllMocks()
  sessionStorage.clear()
  entries.length = 0
  writes = []
  fail = false
  vi.spyOn(api, "GET").mockImplementation((async () => ({
    data: { items: [...entries] },
    response: new Response(),
  })) as never)
  vi.spyOn(api, "PUT").mockImplementation((async (
    _path: string,
    options: {
      params: { path: { entry_id: string; hotel_id: string } }
      body: { title: string; description: string }
    },
  ) => {
    const { entry_id: id, hotel_id } = options.params.path
    writes.push(id)
    if (fail) throw new Error("offline")
    const value = { id, hotel_id, ...options.body }
    const index = entries.findIndex((entry) => entry.id === id)
    if (index < 0) entries.push(value)
    else entries[index] = value
    return { data: value, response: new Response() }
  }) as never)
})

function mount() {
  return render(
    <MemoryRouter>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <LocaleProvider>
          <HotelierData hotelId="h1" questions={[]} facts={[]} />
        </LocaleProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

async function openEntry() {
  await waitFor(() =>
    expect((screen.getByRole("button", { name: w.add }) as HTMLButtonElement).disabled).toBe(false),
  )
  await userEvent.click(screen.getByRole("button", { name: w.add }))
}

it("saves a proactive entry, reloads it and edits it without adding a question", async () => {
  const view = mount()
  await openEntry()
  await userEvent.type(screen.getByRole("textbox", { name: w.entryTitle }), "Early arrival")
  await userEvent.type(screen.getByRole("textbox", { name: w.entryDescription }), "After 10am")
  await userEvent.click(screen.getByRole("button", { name: w.addEntry }))
  expect(await screen.findByText("After 10am")).toBeTruthy()
  view.unmount()
  mount()
  await userEvent.click(await screen.findByRole("button", { name: w.edit }))
  const description = screen.getByRole("textbox", { name: w.entryDescription })
  await userEvent.clear(description)
  await userEvent.type(description, "After noon")
  await userEvent.click(screen.getByRole("button", { name: w.save }))
  expect(await screen.findByText("After noon")).toBeTruthy()
  expect(entries).toHaveLength(1)
  expect(writes[0]).toBe(writes[1])
})

it("retains failed input and reuses the entry identifier when retrying", async () => {
  mount()
  await openEntry()
  await userEvent.type(screen.getByRole("textbox", { name: w.entryTitle }), "Arrival")
  await userEvent.type(screen.getByRole("textbox", { name: w.entryDescription }), "After 10am")
  fail = true
  await userEvent.click(screen.getByRole("button", { name: w.addEntry }))
  expect(await screen.findByText(w.saveFailed)).toBeTruthy()
  await userEvent.click(screen.getByRole("button", { name: w.cancel }))
  await openEntry()
  expect((screen.getByRole("textbox", { name: w.entryTitle }) as HTMLInputElement).value).toBe(
    "Arrival",
  )
  fail = false
  await userEvent.click(screen.getByRole("button", { name: w.addEntry }))
  expect(await screen.findByText("After 10am")).toBeTruthy()
  expect(writes[0]).toBe(writes[1])
})

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { FactCorrection } from "@/features/fact-details/fact-correction"
import { api } from "@/shared/api"
import type { Fact } from "@/shared/api/hotel-types"
import { clearSessionDraft, readSessionDraft } from "@/shared/hooks/session-draft"
import copy from "@/shared/i18n/locales/ru/explore.json"

const fact: Fact = {
  fact_id: "f_height",
  label: "Height",
  characteristic_key: "building_height",
  value: 12,
  unit: "m",
  confidence: 1,
  source_type: "computed",
  status: "active",
}

function mount() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <FactCorrection fact={fact} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
  clearSessionDraft("fact:f_height", readSessionDraft("fact:f_height").value)
  sessionStorage.clear()
})

describe("fact correction safety", () => {
  it.each(["", "   ", "not-a-number", "1,2.3", "-1"])(
    "rejects invalid numeric input %s visibly",
    async (value) => {
      const post = vi.spyOn(api, "POST").mockResolvedValue({
        data: fact,
        response: new Response("{}"),
      } as never)
      mount()
      await userEvent.click(screen.getByRole("button", { name: copy.details.wrong }))
      const field = screen.getByRole("textbox", { name: copy.details.correction })
      fireEvent.change(field, { target: { value } })
      fireEvent.submit(field.closest("form") as HTMLFormElement)
      expect(post).not.toHaveBeenCalled()
      expect(field.getAttribute("aria-invalid")).toBe("true")
      expect(screen.getByRole("alert").textContent).toBeTruthy()
    },
  )

  it.each([
    ["0", 0],
    ["12,5", 12.5],
    ["12.5", 12.5],
  ])("saves explicit %s as %s", async (value, expected) => {
    const post = vi.spyOn(api, "POST").mockResolvedValue({
      data: fact,
      response: new Response("{}"),
    } as never)
    mount()
    await userEvent.click(screen.getByRole("button", { name: copy.details.wrong }))
    const field = screen.getByRole("textbox", { name: copy.details.correction })
    fireEvent.change(field, { target: { value } })
    fireEvent.submit(field.closest("form") as HTMLFormElement)
    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(post.mock.calls[0]?.[1]).toMatchObject({ body: { value: expected } })
  })

  it("blocks confirmation while correction is pending", async () => {
    const post = vi.spyOn(api, "POST").mockImplementation(() => new Promise(() => {}))
    mount()
    await userEvent.click(screen.getByRole("button", { name: copy.details.wrong }))
    const field = screen.getByRole("textbox", { name: copy.details.correction })
    fireEvent.change(field, { target: { value: "15" } })
    fireEvent.submit(field.closest("form") as HTMLFormElement)
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    const confirm = screen.getByRole("button", { name: copy.details.confirm })
    expect(confirm.hasAttribute("disabled")).toBe(true)
    fireEvent.click(confirm)
    fireEvent.submit(field.closest("form") as HTMLFormElement)
    expect(post).toHaveBeenCalledTimes(1)
  })
})

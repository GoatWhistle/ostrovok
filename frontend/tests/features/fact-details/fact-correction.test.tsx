import { QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { FactCorrection } from "@/features/fact-details/fact-correction"
import { api } from "@/shared/api"
import type { Fact } from "@/shared/api/hotel-types"
import { clearSessionDraft, readSessionDraft } from "@/shared/hooks/session-draft"
import { LocaleProvider } from "@/shared/i18n"
import copy from "@/shared/i18n/locales/ru/explore.json"
import { registryClient } from "../hotelier-answer/registry"

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

function mount(subject: Fact = fact) {
  return render(
    <QueryClientProvider client={registryClient()}>
      <LocaleProvider>
        <FactCorrection fact={subject} />
      </LocaleProvider>
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

const weightLabel = `${copy.answerFields.max_weight_kg.label}, ${copy.answerFields.max_weight_kg.unit}`
const feeLabel = `${copy.answerFields.fee_rub.label}, ${copy.answerFields.fee_rub.unit}`

describe("typed corrections", () => {
  const pets: Fact = {
    ...fact,
    fact_id: "f_pets",
    characteristic_key: "pets_policy",
    value: { allowed: true, max_weight_kg: 10, fee_rub: null },
    unit: null,
  }

  it("edits pet conditions as fields and sends a typed object with the comment", async () => {
    const post = vi.spyOn(api, "POST").mockResolvedValue({
      data: pets,
      response: new Response("{}"),
    } as never)
    mount(pets)
    await userEvent.click(screen.getByRole("button", { name: copy.details.wrong }))
    expect(
      (screen.getByRole("radio", { name: copy.answerFields.allowed.yes }) as HTMLInputElement)
        .checked,
    ).toBe(true)
    expect((screen.getByRole("textbox", { name: weightLabel }) as HTMLInputElement).value).toBe(
      "10",
    )
    await userEvent.type(screen.getByRole("textbox", { name: feeLabel }), "0")
    await userEvent.type(
      screen.getByRole("textbox", { name: copy.answerFields.correctionNote }),
      "No surcharge",
    )
    await userEvent.click(screen.getByRole("button", { name: copy.details.save }))
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    expect(post.mock.calls[0]?.[1]).toMatchObject({
      body: { value: { allowed: true, max_weight_kg: 10, fee_rub: 0 }, comment: "No surcharge" },
    })
  })

  it("drops conditions from a refusal", async () => {
    const post = vi.spyOn(api, "POST").mockResolvedValue({
      data: pets,
      response: new Response("{}"),
    } as never)
    mount({ ...pets, fact_id: "f_pets_refused" })
    await userEvent.click(screen.getByRole("button", { name: copy.details.wrong }))
    await userEvent.click(screen.getByRole("radio", { name: copy.answerFields.allowed.no }))
    await userEvent.click(screen.getByRole("button", { name: copy.details.save }))
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    expect(post.mock.calls[0]?.[1]).toMatchObject({ body: { value: { allowed: false } } })
  })

  it("names boolean corrections by the property, not by search matches", async () => {
    mount({ ...fact, fact_id: "f_room", characteristic_key: "double_room", value: true })
    await userEvent.click(screen.getByRole("button", { name: copy.details.wrong }))
    expect(screen.getByRole("radio", { name: copy.answerFields.present.yes })).toBeTruthy()
    expect(screen.getByRole("radio", { name: copy.answerFields.present.no })).toBeTruthy()
    expect(screen.queryByRole("radio", { name: copy.match.full })).toBeNull()
  })
})

describe("correction dismissal", () => {
  it("keeps a collapsed draft and discards a cancelled draft", async () => {
    mount()
    const edit = screen.getByRole("button", { name: copy.details.wrong })
    await userEvent.click(edit)
    const field = screen.getByRole("textbox", { name: copy.details.correction })
    await userEvent.clear(field)
    await userEvent.type(field, "19")
    await userEvent.keyboard("{Escape}")
    await waitFor(() =>
      expect(screen.queryByRole("textbox", { name: copy.details.correction })).toBeNull(),
    )
    expect(document.activeElement).toBe(edit)
    await userEvent.click(edit)
    expect(
      (screen.getByRole("textbox", { name: copy.details.correction }) as HTMLInputElement).value,
    ).toBe("19")
    await userEvent.click(screen.getByRole("button", { name: copy.details.cancel }))
    await waitFor(() =>
      expect(screen.queryByRole("textbox", { name: copy.details.correction })).toBeNull(),
    )
    await userEvent.click(edit)
    expect(
      (screen.getByRole("textbox", { name: copy.details.correction }) as HTMLInputElement).value,
    ).toBe("12")
  })
})

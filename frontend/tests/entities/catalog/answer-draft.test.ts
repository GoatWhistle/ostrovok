import { describe, expect, it } from "vitest"
import {
  type AnswerDraft,
  type AnswerField,
  type AnswerPhrases,
  composeAnswer,
  draftFromValue,
  EMPTY_DRAFT,
  invalidFields,
  parseNumber,
  readDraft,
  typedValue,
  visibleFields,
  writeDraft,
} from "@/entities/catalog/answer-fields/answer-draft"

const PETS: readonly AnswerField[] = [
  { name: "allowed", kind: "bool", unit: null },
  { name: "max_weight_kg", kind: "number", unit: "kg" },
  { name: "fee_rub", kind: "number", unit: "₽" },
]
const ADULTS: readonly AnswerField[] = [{ name: "adults", kind: "number", unit: "adults" }]
const PRESENT: readonly AnswerField[] = [{ name: "present", kind: "bool", unit: null }]

const phrases: AnswerPhrases = {
  choice: (field, choice) => `${field.name}=${choice}`,
  number: (field, value) => `${field.name} ${value}`,
}

function draft(patch: Partial<AnswerDraft>): AnswerDraft {
  return { ...EMPTY_DRAFT, ...patch }
}

describe("answer numbers", () => {
  it.each([
    ["12", 12],
    [" 12,5 ", 12.5],
    ["0.5", 0.5],
    [",5", 0.5],
    ["0", 0],
  ])("reads %j as %s", (text, value) => {
    expect(parseNumber(text)).toMatchObject({ kind: "value", value })
  })

  it.each(["1,2.3", "-1", "+3", "12 kg", "abc", "1e3"])("rejects %j", (text) => {
    expect(parseNumber(text).kind).toBe("invalid")
  })

  it("keeps blank separate from zero", () => {
    expect(parseNumber("   ").kind).toBe("empty")
  })
})

describe("answer composition", () => {
  it("shows conditions only once the gating choice is yes", () => {
    expect(visibleFields(PETS, EMPTY_DRAFT).map((field) => field.name)).toEqual(["allowed"])
    const no = draft({ choices: { allowed: "no" }, numbers: { max_weight_kg: "10" } })
    expect(visibleFields(PETS, no).map((field) => field.name)).toEqual(["allowed"])
    const yes = draft({ choices: { allowed: "yes" } })
    expect(visibleFields(PETS, yes)).toHaveLength(3)
    expect(visibleFields(ADULTS, EMPTY_DRAFT)).toHaveLength(1)
  })

  it("writes only entered values, in registry order, with the explanation last", () => {
    const filled = draft({
      choices: { allowed: "yes" },
      numbers: { fee_rub: "500", max_weight_kg: "10" },
      note: "  Dogs only  ",
    })
    expect(composeAnswer(PETS, filled, phrases)).toBe(
      "Allowed=yes. Max_weight_kg 10. Fee_rub 500. Dogs only",
    )
    const partial = draft({ choices: { allowed: "yes" }, numbers: { max_weight_kg: "10" } })
    expect(composeAnswer(PETS, partial, phrases)).toBe("Allowed=yes. Max_weight_kg 10.")
  })

  it("leaves unknown and hidden values out of the text", () => {
    expect(composeAnswer(PRESENT, EMPTY_DRAFT, phrases)).toBe("")
    const hidden = draft({ choices: { allowed: "no" }, numbers: { fee_rub: "500" } })
    expect(composeAnswer(PETS, hidden, phrases)).toBe("Allowed=no.")
    expect(composeAnswer(PRESENT, draft({ note: "Will check with the manager" }), phrases)).toBe(
      "Will check with the manager",
    )
  })

  it("flags malformed numbers and, on request, missing required ones", () => {
    const broken = draft({ choices: { allowed: "yes" }, numbers: { max_weight_kg: "1,2.3" } })
    expect(invalidFields(PETS, broken)).toEqual(["max_weight_kg"])
    expect(invalidFields(ADULTS, EMPTY_DRAFT)).toEqual([])
    expect(invalidFields(ADULTS, EMPTY_DRAFT, true)).toEqual(["adults"])
  })
})

describe("typed values", () => {
  it("never turns unknown into false or blank into zero", () => {
    expect(typedValue("bool", PRESENT, EMPTY_DRAFT)).toBeUndefined()
    expect(typedValue("bool", PRESENT, draft({ choices: { present: "no" } }))).toBe(false)
    expect(typedValue("number", ADULTS, draft({ numbers: { adults: " " } }))).toBeUndefined()
    expect(typedValue("number", ADULTS, draft({ numbers: { adults: "0" } }))).toBe(0)
  })

  it("builds objects from known fields only", () => {
    const pets = draft({ choices: { allowed: "yes" }, numbers: { fee_rub: "0" } })
    expect(typedValue("object", PETS, pets)).toEqual({ allowed: true, fee_rub: 0 })
    const refused = draft({ choices: { allowed: "no" }, numbers: { fee_rub: "500" } })
    expect(typedValue("object", PETS, refused)).toEqual({ allowed: false })
    expect(typedValue("object", PETS, EMPTY_DRAFT)).toBeUndefined()
  })

  it("starts a correction from the stored value", () => {
    expect(draftFromValue(PETS, { allowed: true, max_weight_kg: 10, fee_rub: null })).toEqual({
      choices: { allowed: "yes" },
      numbers: { max_weight_kg: "10" },
      note: "",
    })
    expect(draftFromValue(ADULTS, 4)).toEqual({ choices: {}, numbers: { adults: "4" }, note: "" })
    expect(draftFromValue(PRESENT, false).choices).toEqual({ present: "no" })
  })
})

describe("stored drafts", () => {
  it("round-trips structured drafts and keeps older plain text as the explanation", () => {
    const stored = draft({ choices: { allowed: "no" }, numbers: { fee_rub: "5" }, note: "x" })
    expect(readDraft(writeDraft(stored))).toEqual(stored)
    expect(readDraft("Two rooms")).toEqual(draft({ note: "Two rooms" }))
    expect(readDraft("12")).toEqual(draft({ note: "12" }))
    expect(readDraft('{"choices":{"allowed":"maybe"},"numbers":{"fee_rub":5}}')).toEqual(
      EMPTY_DRAFT,
    )
    expect(readDraft("")).toEqual(EMPTY_DRAFT)
  })
})

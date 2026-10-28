import { expect, test } from "@playwright/test"
import copy from "../src/shared/i18n/locales/ru/explore.json" with { type: "json" }
import { FACT, installHotelContract } from "../tests/contract/hotel-fixtures"

test("hotelier draft survives hotel changes and reload", async ({ page }) => {
  await installHotelContract(page)
  await page.goto("/hotelier/h_test_a", { waitUntil: "domcontentloaded" })
  const note = page.getByRole("textbox", { name: copy.answerFields.note, exact: true })
  await note.fill("Original room conditions")
  await page.goto("/hotelier/h_test_b", { waitUntil: "domcontentloaded" })
  await expect(note).toHaveValue("")
  await note.fill("Different hotel")
  await page.goBack()
  await expect(note).toHaveValue("Original room conditions")
  await page.reload()
  await expect(note).toHaveValue("Original room conditions")
})

test("hotelier error retains the answer and retry distinguishes follow up and conflict", async ({
  page,
}) => {
  await installHotelContract(page)
  let attempt = 0
  await page.route("**/hotelier/questions/*/answer", (route) => {
    attempt++
    if (attempt === 1)
      return route.fulfill({ status: 503, json: { code: "model_failure", message: "Offline" } })
    return route.fulfill({
      json: {
        question_id: "q_test",
        extracted: attempt === 2 ? [] : [FACT],
        conflicts: attempt === 2 ? [] : [{ id: "c_test", fact_ids: [FACT.fact_id] }],
        follow_up:
          attempt === 2
            ? { id: "q_test", text: "Which floor?", characteristic_key: "sunset_view" }
            : null,
      },
    })
  })
  await page.goto("/hotelier/h_test_a", { waitUntil: "domcontentloaded" })
  const note = page.getByRole("textbox", { name: copy.answerFields.note, exact: true })
  const send = page.getByRole("button", { name: copy.hotelier.send, exact: true })
  await note.fill("West facing rooms")
  await send.click()
  await expect(page.getByText(copy.hotelier.failed, { exact: true })).toBeVisible()
  await expect(note).toHaveValue("West facing rooms")
  await send.click()
  await expect(page.getByText("Which floor?", { exact: true })).toBeVisible()
  await expect(note).toHaveValue("West facing rooms")
  await note.fill("West facing rooms on floor five")
  await send.click()
  await expect(page.getByText(copy.hotelier.savedConflict, { exact: true })).toBeVisible()
  expect(attempt).toBe(3)
})

test("correction collapse and cancel preserve different values and restore focus", async ({
  page,
}) => {
  await installHotelContract(page)
  await page.goto("/hotelier/h_test_a", { waitUntil: "domcontentloaded" })
  await page.getByRole("button", { name: copy.hotelier.preview, exact: true }).click()
  const facts = page.getByRole("dialog", { name: copy.hotelier.preview, exact: true })
  const fact = facts.locator("[data-fact-trigger]").first()
  await fact.click()
  const edit = facts.getByRole("button", { name: copy.details.wrong, exact: true })
  await edit.click()
  const value = facts.getByRole("textbox", { name: copy.details.correction, exact: true })
  await value.fill("18")
  await value.press("Escape")
  await expect(edit).toBeFocused()
  await edit.press("Enter")
  await expect(value).toHaveValue("18")
  await facts.getByRole("button", { name: copy.details.cancel, exact: true }).click()
  await expect(edit).toBeFocused()
  await edit.press("Enter")
  await expect(value).toHaveValue("6")
  await value.press("Escape")
  await edit.press("Escape")
  await expect(fact).toBeFocused()
})

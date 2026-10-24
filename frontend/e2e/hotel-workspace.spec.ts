import { expect, test } from "@playwright/test"
import copy from "../src/shared/i18n/locales/ru/explore.json" with { type: "json" }
import { FACT, HOTELS, installHotelContract } from "../tests/contract/hotel-fixtures"

test("real backend metadata and a missing search remain honest", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("app-locale", "ru")
  })
  await page.goto("/")
  await expect(page.getByText(copy.service.online, { exact: true })).toBeVisible()
  const catalog = await (await page.request.get("/api/v1/characteristics")).json()
  await expect(
    page.getByRole("button", { name: catalog.items[0].title, exact: true }),
  ).toBeVisible()
  await page.getByRole("textbox", { name: copy.search.label }).fill("Quiet room")
  await page.getByRole("button", { name: copy.search.submit, exact: true }).click()
  await expect(page.getByText(copy.results.error, { exact: true })).toBeVisible()
})

test("same search can be refreshed and an API fact opens its evidence", async ({ page }) => {
  const calls = await installHotelContract(page)
  await page.goto("/")
  await page.getByRole("textbox", { name: copy.search.label }).fill("To the sea")
  const submit = page.getByRole("button", { name: copy.search.submit, exact: true })
  await submit.click()
  await expect(page.getByRole("button", { name: HOTELS[0]?.name ?? "", exact: true })).toBeVisible()
  await expect.poll(() => calls.searches).toBe(1)
  await submit.click()
  await expect.poll(() => calls.searches).toBe(2)
  await page.getByRole("button", { name: HOTELS[0]?.name ?? "", exact: true }).click()
  await page
    .getByRole("button", { name: new RegExp(FACT.label) })
    .first()
    .click()
  await expect(page.getByText(FACT.explanation, { exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: copy.details.source, exact: true })).toHaveAttribute(
    "href",
    "https://www.openstreetmap.org/",
  )
  await expect.poll(() => calls.batches).toBeGreaterThan(0)
  await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible()
  await expect(page.getByText(copy.map.unsupported, { exact: true })).toBeHidden()
})

test("mobile selection transfers keyboard focus into visible hotel details", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 })
  await installHotelContract(page)
  await page.goto("/")
  await page.getByRole("textbox", { name: copy.search.label }).fill("To the sea")
  await page.getByRole("button", { name: copy.search.submit, exact: true }).click()
  await page.getByRole("button", { name: HOTELS[0]?.name ?? "", exact: true }).click()
  await expect(page.getByRole("complementary", { name: copy.details.title })).toBeFocused()
  await expect(page.getByRole("button", { name: copy.search.submit, exact: true })).toBeHidden()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
})

test("comparison uses selected hotel ids and displays API values", async ({ page }) => {
  await installHotelContract(page)
  await page.goto("/")
  await page.getByRole("textbox", { name: copy.search.label }).fill("To the sea")
  await page.getByRole("button", { name: copy.search.submit, exact: true }).click()
  await page.getByRole("button", { name: copy.results.compare, exact: true }).first().click()
  await page.getByRole("button", { name: copy.results.compare, exact: true }).first().click()
  await page.getByRole("link", { name: new RegExp(copy.navigation.compare) }).click()
  await expect(page.getByRole("table")).toBeVisible()
  await expect(page.getByRole("cell", { name: new RegExp(FACT.label) }).first()).toBeVisible()
})

test("hotelier answer, confirmation and correction use real contract mutations", async ({
  page,
}) => {
  const calls = await installHotelContract(page)
  await page.goto("/hotelier/h_test_a")
  await page
    .getByRole("textbox", { name: copy.hotelier.answer, exact: true })
    .fill("West-facing rooms from floor five")
  await page.getByRole("button", { name: copy.hotelier.send, exact: true }).click()
  await expect.poll(() => calls.answers).toBe(1)
  await page.getByRole("button", { name: new RegExp(FACT.label) }).click()
  await page.getByRole("button", { name: copy.details.confirm, exact: true }).click()
  await expect.poll(() => calls.confirmed).toBe(1)
  await page.getByRole("button", { name: copy.details.correct, exact: true }).click()
  await page.getByRole("textbox", { name: copy.details.correction }).fill("8")
  await page.getByRole("button", { name: copy.details.save, exact: true }).click()
  await expect.poll(() => calls.corrected).toBe(1)
})

test("mobile results contain long source text and missing optional fields", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 })
  await installHotelContract(page)
  await page.route("**/api/v1/search", (route) =>
    route.fulfill({
      json: {
        query_id: "long_text",
        parsed: { intents: [] },
        results: [
          {
            hotel: { id: "long_hotel", name: "InternationalWaterfrontResidence".repeat(8) },
            matched: [],
            score: 0,
          },
        ],
      },
    }),
  )
  await page.goto("/")
  await page.getByRole("textbox", { name: copy.search.label }).fill("Long name")
  await page.getByRole("button", { name: copy.search.submit, exact: true }).click()
  await expect(page.getByRole("button", { name: copy.results.open, exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
})

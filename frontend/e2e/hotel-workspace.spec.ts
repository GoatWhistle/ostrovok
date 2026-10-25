import { expect, test } from "@playwright/test"
import copy from "../src/shared/i18n/locales/ru/explore.json" with { type: "json" }
import { FACT, HOTELS, installHotelContract } from "../tests/contract/hotel-fixtures"

test("real backend metadata and a missing search remain honest", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("app-locale", "ru")
  })
  await page.route("**/api/v1/chat/messages", (route) =>
    route.fulfill({ status: 503, json: { code: "model_failure", message: "Unavailable" } }),
  )
  await page.goto("/")
  await page.getByRole("textbox", { name: copy.chat.composer }).fill("Quiet room")
  await page.getByRole("button", { name: copy.chat.send, exact: true }).click()
  await expect(page.getByText(copy.chat.error, { exact: true })).toBeVisible()
})

test("chat refinement keeps results and shows a matched route on the map", async ({ page }) => {
  const calls = await installHotelContract(page)
  await page.goto("/")
  const message = page.getByRole("textbox", { name: copy.chat.composer })
  await message.fill("To the sea")
  const submit = page.getByRole("button", { name: copy.chat.send, exact: true })
  await submit.click()
  await expect(page.getByRole("button", { name: HOTELS[0]?.name ?? "", exact: true })).toBeVisible()
  await expect.poll(() => calls.searches).toBe(1)
  await message.fill("And near shops")
  await submit.click()
  await expect.poll(() => calls.searches).toBe(2)
  await page.getByRole("button", { name: HOTELS[0]?.name ?? "", exact: true }).click()
  await page
    .getByRole("button", { name: new RegExp(copy.facts.distanceToSea.replace("{{value}}", "6")) })
    .first()
    .click()
  await expect(page.getByText(FACT.explanation, { exact: true })).toBeVisible()
  await expect.poll(() => calls.batches).toBeGreaterThan(0)
  await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible()
})

test("new search starts a separate chat and saved chats reopen", async ({ page }) => {
  await installHotelContract(page)
  const firstId = "00000000-0000-0000-0000-000000000011"
  const secondId = "00000000-0000-0000-0000-000000000012"
  const requests: (string | null)[] = []
  const chats = new Map<string, { id: string; messages: object[] }>()
  await page.route("**/api/v1/chat/messages", (route) => {
    const body = route.request().postDataJSON()
    const previousId = body.conversation_id as string | null
    requests.push(previousId)
    const id = previousId ?? (chats.size === 0 ? firstId : secondId)
    const current = chats.get(id) ?? { id, messages: [] }
    current.messages.push(
      {
        id: `${id}-u-${current.messages.length}`,
        role: "user",
        content: body.message,
        created_at: new Date().toISOString(),
      },
      {
        id: `${id}-a-${current.messages.length}`,
        role: "assistant",
        content: "Reply",
        created_at: new Date().toISOString(),
      },
    )
    chats.set(id, current)
    return route.fulfill({ json: current })
  })
  await page.route("**/api/v1/chat/conversations/*", (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-1) ?? ""
    const conversation = chats.get(id)
    return conversation
      ? route.fulfill({ json: conversation })
      : route.fulfill({ status: 404, json: { code: "not_found", message: "Missing" } })
  })
  await page.goto("/")
  const log = page.getByRole("log", { name: copy.chat.log })
  const composer = page.getByRole("textbox", { name: copy.chat.composer })
  const send = page.getByRole("button", { name: copy.chat.send, exact: true })
  await composer.fill("First request")
  await send.click()
  await expect(log.getByText("First request", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: copy.chat.newSearch }).click()
  await composer.fill("Second request")
  await send.click()
  await expect(log.getByText("Second request", { exact: true })).toBeVisible()
  await expect(log.getByText("First request", { exact: true })).toBeHidden()
  await page.getByRole("button", { name: copy.chat.history }).click()
  await page
    .getByRole("navigation", { name: copy.chat.history })
    .getByRole("button", { name: "First request" })
    .click()
  await expect(log.getByText("First request", { exact: true })).toBeVisible()
  await expect(log.getByText("Second request", { exact: true })).toBeHidden()
  await composer.fill("Follow up")
  await send.click()
  await expect.poll(() => requests).toEqual([null, null, firstId])
  await page.reload()
  await expect(log.getByText("First request", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: copy.chat.history }).click()
  await expect(
    page
      .getByRole("navigation", { name: copy.chat.history })
      .getByRole("button", { name: "Second request" }),
  ).toBeVisible()
})

test("mobile selection transfers keyboard focus into visible hotel details", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 })
  await installHotelContract(page)
  await page.goto("/")
  await page.getByRole("textbox", { name: copy.chat.composer }).fill("To the sea")
  await page.getByRole("button", { name: copy.chat.send, exact: true }).click()
  await page.getByRole("radio", { name: copy.panel.hotels, exact: true }).check()
  await page.getByRole("button", { name: HOTELS[0]?.name ?? "", exact: true }).click()
  await expect(page.getByLabel(copy.details.title, { exact: true })).toBeFocused()
  await expect(page.getByRole("button", { name: copy.chat.send, exact: true })).toBeHidden()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
})

test("comparison uses selected hotel ids and displays API values", async ({ page }) => {
  await installHotelContract(page)
  await page.goto("/")
  await page.getByRole("textbox", { name: copy.chat.composer }).fill("To the sea")
  await page.getByRole("button", { name: copy.chat.send, exact: true }).click()
  await page.getByRole("button", { name: HOTELS[0]?.name ?? "", exact: true }).click()
  await page.getByRole("button", { name: copy.results.compare, exact: true }).click()
  await page.getByRole("button", { name: copy.panel.back, exact: true }).click()
  await page.getByRole("button", { name: HOTELS[1]?.name ?? "", exact: true }).click()
  await page.getByRole("button", { name: copy.results.compare, exact: true }).click()
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
    .getByRole("textbox", { name: copy.hotelier.detailed, exact: true })
    .fill("West-facing rooms from floor five")
  await page.getByRole("button", { name: copy.hotelier.send, exact: true }).click()
  await expect.poll(() => calls.answers).toBe(1)
  await page.getByRole("button", { name: new RegExp(copy.facts.titleSea) }).click()
  await page.getByRole("button", { name: copy.details.confirm, exact: true }).click()
  await expect.poll(() => calls.confirmed).toBe(1)
  await page.getByRole("button", { name: copy.details.wrong, exact: true }).click()
  await page.getByRole("textbox", { name: copy.details.correction }).fill("8")
  await page.getByRole("button", { name: copy.details.save, exact: true }).click()
  await expect.poll(() => calls.corrected).toBe(1)
})

test("mobile results contain long source text and missing optional fields", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await installHotelContract(page)
  await page.route("**/api/v1/chat/messages", (route) =>
    route.fulfill({
      json: {
        id: "00000000-0000-0000-0000-000000000001",
        messages: [],
        effective_query: "Long name",
        search: {
          query_id: "long_text",
          parsed: { intents: [] },
          results: [
            {
              hotel: {
                id: "long_hotel",
                name: "International Seafront Apartments at the Sochi Railway Station and Coastal Promenade",
                location: [39.72, 43.58],
              },
              matched: [],
              score: 0,
              camera: { center: [39.72, 43.58], zoom: 17, pitch: 55, bearing: 0 },
            },
          ],
        },
      },
    }),
  )
  await page.goto("/")
  await page.getByRole("textbox", { name: copy.chat.composer }).fill("Long name")
  await page.getByRole("button", { name: copy.chat.send, exact: true }).click()
  await page.getByRole("radio", { name: copy.panel.hotels, exact: true }).check()
  await expect(page.getByText(/International Seafront Apartments/)).toBeVisible()
  const overflow = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("*")]
      .filter(
        (item) => item.offsetParent !== null && item.getBoundingClientRect().right > innerWidth + 1,
      )
      .slice(0, 10)
      .map((item) => ({
        tag: item.tagName,
        className: item.className,
        right: item.getBoundingClientRect().right,
      })),
  )
  expect(overflow).toEqual([])
})

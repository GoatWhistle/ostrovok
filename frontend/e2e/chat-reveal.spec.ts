import { expect, test } from "@playwright/test"
import en from "../src/shared/i18n/locales/en/explore.json" with { type: "json" }
import common from "../src/shared/i18n/locales/ru/common.json" with { type: "json" }
import ru from "../src/shared/i18n/locales/ru/explore.json" with { type: "json" }
import { conversationFixture, installConversationFlow } from "../tests/contract/conversation-flow"

test.use({ launchOptions: { args: ["--disable-webgl"] } })

for (const width of [375, 1440])
  for (const theme of ["light", "dark"])
    for (const locale of ["ru", "en"] as const) {
      test(`chat reveals results without losing the input: ${width} ${theme} ${locale}`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 })
        await page.emulateMedia({ reducedMotion: width === 375 ? "reduce" : "no-preference" })
        await page.addInitScript(
          ({ theme, locale }) => {
            localStorage.setItem("app-theme", theme)
            localStorage.setItem("app-locale", locale)
          },
          { theme, locale },
        )
        const copy = locale === "ru" ? ru : en
        const flow = await installConversationFlow(page)
        await page.goto("/")
        const composer = page.getByRole("textbox", { name: copy.chat.composer })
        await composer.fill("Hotel by the sea")
        await page.getByRole("button", { name: copy.chat.send, exact: true }).click()
        await expect(page.locator('[data-surface="conversation"]').first()).toBeVisible()
        const chat = page.getByRole("region", { name: copy.chat.newSearch })
        const bounds = await chat.boundingBox()
        expect(bounds?.width).toBe(width)
        await composer.fill("Keep this next message")
        await composer.evaluate((element) => element.setAttribute("data-kept-input", "true"))
        await expect.poll(() => flow.pending.length).toBe(1)
        await flow.respond(conversationFixture(true))
        await expect(page.locator('[data-surface="workspace"]').first()).toBeVisible()
        await expect(composer).toHaveValue("Keep this next message")
        await expect(composer).toHaveAttribute("data-kept-input", "true")
        await expect(composer).toBeFocused()
        if (width === 375)
          await page.getByRole("radio", { name: copy.panel.hotels, exact: true }).click()
        await expect(
          page.getByRole("button", { name: "Test hotel A", exact: true }).first(),
        ).toBeVisible()
        await page.screenshot({
          path: `test-results/e16-reveal-${width}-${theme}-${locale}.png`,
        })
        if (width === 375)
          await page.getByRole("radio", { name: copy.panel.chat, exact: true }).click()
        await composer.fill("No matches now")
        await page.getByRole("button", { name: copy.chat.send, exact: true }).click()
        await expect.poll(() => flow.pending.length).toBe(1)
        await flow.respond(conversationFixture(false, 2))
        await expect(page.locator('[data-surface="workspace"]').first()).toBeVisible()
        if (width === 375)
          await page.getByRole("radio", { name: copy.panel.hotels, exact: true }).click()
        await expect(page.getByText(copy.panel.noneTitle, { exact: true })).toBeVisible()
        expect(flow.posts).toBe(2)
      })
    }

test("first error, retry and empty result keep a full chat", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("app-locale", "ru"))
  const flow = await installConversationFlow(page)
  await page.goto("/")
  await page.getByRole("textbox", { name: ru.chat.composer }).fill("Original request")
  await page.getByRole("button", { name: ru.chat.send, exact: true }).click()
  await expect.poll(() => flow.pending.length).toBe(1)
  await flow.fail()
  await expect(page.getByText(ru.chat.error, { exact: true })).toBeVisible()
  await expect(page.locator('[data-surface="conversation"]').first()).toBeVisible()
  await page.getByRole("button", { name: common.action.retry, exact: true }).click()
  await expect.poll(() => flow.pending.length).toBe(1)
  await flow.respond(conversationFixture(false))
  await expect(page.locator('[data-surface="conversation"]').first()).toBeVisible()
  expect(flow.requests).toEqual(["Original request", "Original request"])
  await page.reload()
  await expect(page.locator('[data-surface="conversation"]').first()).toBeVisible()
  expect(flow.posts).toBe(2)
})

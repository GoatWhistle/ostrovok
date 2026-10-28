import { expect, test } from "@playwright/test"
import copy from "../src/shared/i18n/locales/ru/explore.json" with { type: "json" }
import { installHotelContract } from "../tests/contract/hotel-fixtures"

test.use({ launchOptions: { args: ["--disable-webgl"] } })

for (const width of [375, 1440]) {
  test(`opens a hotel from the whole tile and returns to the list at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await installHotelContract(page)
    await page.goto("/?chat=00000000-0000-0000-0000-000000000001&tab=hotels")
    await expect(page.getByText(copy.panel.matchedHotels, { exact: true })).toBeVisible()
    for (const position of [
      { x: 8, y: 8 },
      { x: 35, y: 45 },
      { x: 150, y: 75 },
    ]) {
      const hotel = page.getByRole("button", { name: "Test hotel A", exact: true })
      const tile = page.locator("article").filter({ has: hotel })
      await tile.click({ position })
      await expect(page.getByRole("tablist", { name: copy.hotelCard.tabs })).toBeVisible()
      await expect(page).toHaveURL(/hotel=h_test_a/)
      await page.getByRole("button", { name: copy.panel.back, exact: true }).click()
      await expect(hotel).toBeVisible()
      await expect(hotel).toBeFocused()
      await expect(page).not.toHaveURL(/hotel=/)
    }
    await page.getByRole("button", { name: copy.cards.whyMatch }).first().click()
    await expect(page.getByRole("tablist", { name: copy.hotelCard.tabs })).toHaveCount(0)
  })
}

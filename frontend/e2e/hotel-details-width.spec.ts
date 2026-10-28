import { expect, type Page, test } from "@playwright/test"
import copy from "../src/shared/i18n/locales/ru/explore.json" with { type: "json" }
import { HOTELS, installHotelContract } from "../tests/contract/hotel-fixtures"

test.use({ launchOptions: { args: ["--disable-webgl"] } })

const CHAT = "00000000-0000-0000-0000-000000000001"
const LONG = "Guest house Lighthouse in Koty on the Baikal shore with a panoramic terrace"

const DETAILS = {
  hotel_id: HOTELS[0]?.id,
  status: "available",
  source: "Supplier",
  sandbox: false,
  room_groups: [],
  details: {
    supplier_id: "1",
    page_url: "https://example.test/hotel/1/",
    name: LONG,
    photos: [],
    facts: { floors_number: 3, rooms_number: 12, year_built: 2004 },
    amenity_groups: [
      {
        name: copy.supplierAmenityGroup.general,
        amenities: Object.values(copy.supplierAmenity).map((name) => ({ name, free: false })),
      },
      ...Array.from({ length: 6 }, (_, group) => ({
        name: `Amenity group number ${group} with a long heading`,
        amenities: Array.from({ length: 8 }, (_, item) => ({
          name: `Amenity ${group}.${item} AVeryLongUnbrokenAmenityNameWithoutSpaces`,
          free: item % 2 === 0,
        })),
      })),
    ],
    description: [
      {
        title: "Location",
        paragraphs: [`${LONG}. ${"A quiet place near the shore. ".repeat(12)}`],
      },
      { title: "Rooms", paragraphs: ["Every room has a view of the lake."] },
    ],
    nearby: Array.from({ length: 9 }, (_, index) => ({
      name: `${LONG} point ${index}`,
      distance_m: 150 + index * 900,
      kind: "BEACH",
    })),
    rating: { total: 9.1, reviews_count: 42, detailed: [] },
    check_in_from: "14:00",
    check_out_until: "12:00",
  },
}

async function openDetails(page: Page, url: string) {
  await installHotelContract(page)
  await page.route("**/api/v1/hotels/*/details", (route) => route.fulfill({ json: DETAILS }))
  await page.goto(url, { waitUntil: "domcontentloaded" })
  const article = page.locator("article[aria-labelledby]").filter({ visible: true }).first()
  await expect(article).toBeVisible()
  await expect(article.getByRole("tablist", { name: copy.hotelCard.tabs })).toBeVisible()
  return article
}

async function overflow(page: Page) {
  return page.evaluate(() => {
    const article = [...document.querySelectorAll("article[aria-labelledby]")].find(
      (item) => item.getClientRects().length > 0,
    )
    let scroller = article?.parentElement ?? null
    while (scroller && !/auto|scroll/.test(getComputedStyle(scroller).overflowY))
      scroller = scroller.parentElement
    const box = (scroller ?? article)?.getBoundingClientRect()
    return {
      extra: scroller ? scroller.scrollWidth - scroller.clientWidth : 0,
      wider: article && box ? article.getBoundingClientRect().right - box.right : 0,
    }
  })
}

for (const [width, path] of [
  [375, `/?chat=${CHAT}&hotel=${HOTELS[0]?.id}&tab=hotels`],
  [768, `/hotels/${HOTELS[0]?.id}?chat=${CHAT}`],
  [1440, `/?chat=${CHAT}&hotel=${HOTELS[0]?.id}`],
] as const) {
  test(`hotel details never scroll sideways at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const article = await openDetails(page, path)
    const tabs = article.getByRole("tablist", { name: copy.hotelCard.tabs })
    for (const panel of [copy.hotelCard.nearby, copy.hotelCard.amenities, copy.hotelCard.about]) {
      await tabs.getByRole("tab", { name: panel, exact: true }).click()
      if (panel === copy.hotelCard.nearby) {
        await expect(article.getByText(`${LONG} point 0`)).toBeVisible()
        await expect(
          article.getByRole("button", { name: copy.hotelCard.supplierDescription }),
        ).toHaveCount(0)
        await expect(article.getByText(`${LONG} point 8`)).toBeVisible()
      }
      if (panel === copy.hotelCard.amenities) {
        const categories = article.locator("[data-amenity-group]")
        let total = 0
        for (const [index, group] of DETAILS.details.amenity_groups.entries()) {
          const category = categories.nth(index)
          await category.getByRole("button").first().click()
          await expect(category.getByRole("listitem")).toHaveCount(group.amenities.length)
          total += await category.getByRole("listitem").count()
          await expect.poll(() => overflow(page)).toEqual({ extra: 0, wider: expect.any(Number) })
        }
        expect(total).toBe(Object.values(copy.supplierAmenity).length + 48)
      }
      if (panel === copy.hotelCard.about) {
        await article.getByRole("button", { name: copy.hotelCard.supplierDescription }).click()
        await expect(
          article.getByText(`${LONG}. ${"A quiet place near the shore. ".repeat(12)}`, {
            exact: true,
          }),
        ).toBeVisible()
        await article.getByRole("button", { name: copy.cards.allEvidence }).click()
      }
      await expect.poll(() => overflow(page)).toEqual({ extra: 0, wider: expect.any(Number) })
      expect((await overflow(page)).wider).toBeLessThanOrEqual(1)
    }
  })
}

import { describe, expect, it } from "vitest"
import { searchJourney } from "@/features/hotel-search/search-journey"

describe("search journey", () => {
  it("asks for a city without selecting a destination", () => {
    const view = searchJourney([{ stage: "parsed", location: null }], true, false, undefined)
    expect(view.status).toBe("city")
    expect(view.bounds).toBeUndefined()
    expect(view.candidates).toEqual([])
  })
  it("uses only the server resolved area and candidates", () => {
    const hotels = [{ id: "one", name: "Hotel", location: [49.1, 55.7] }]
    const view = searchJourney(
      [{ stage: "candidates", location: "Kazan", bbox: [49, 55, 50, 56], hotels }],
      true,
      false,
      undefined,
    )
    expect(view.bounds).toEqual([49, 55, 50, 56])
    expect(view.candidates).toEqual(hotels)
    expect(view.status).toBe("searching")
  })
  it("keeps an empty search on its resolved area", () => {
    const view = searchJourney([{ stage: "candidates", bbox: [49, 55, 50, 56] }], false, false, {
      query_id: "q",
      parsed: {},
      results: [],
    })
    expect(view.status).toBe("empty")
    expect(view.bounds).toEqual([49, 55, 50, 56])
  })
  it("does not use the previous destination while a new search is parsing", () => {
    const view = searchJourney([], true, false, {
      query_id: "old",
      parsed: { location_hint: "Sochi" },
      results: [],
      viewport: { bbox: [1, 2, 3, 4] },
    })
    expect(view.location).toBeUndefined()
    expect(view.bounds).toBeUndefined()
    expect(view.status).toBe("locating")
  })
  it("distinguishes geocoding failure from a search failure", () => {
    expect(
      searchJourney([{ stage: "candidates", unsupported: true }], true, false, undefined).status,
    ).toBe("unresolved")
    expect(searchJourney([], false, true, undefined).status).toBe("error")
  })
})

describe("search presentation", () => {
  it.each(["near bar", "near square", "near waterfront"])(
    "animates %s when the parser requests routing",
    () => {
      expect(
        searchJourney([{ stage: "parsed", route_search: true }], true, false, undefined)
          .routeSearch,
      ).toBe(true)
    },
  )
  it.each(["sunset_view", "pets_policy"])("keeps the waiting screen for %s", (key) => {
    expect(
      searchJourney(
        [{ stage: "parsed", route_search: false, intents: [{ key, term: key }] }],
        true,
        false,
        undefined,
      ).routeSearch,
    ).toBe(false)
  })
  it("does not carry the previous tour into a new request", () => {
    expect(searchJourney([], true, false, undefined).routeSearch).toBe(false)
  })
})

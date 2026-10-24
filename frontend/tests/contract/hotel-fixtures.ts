import type { Page } from "@playwright/test"
export const CAMERA = { center: [39.72, 43.58], zoom: 17, pitch: 55, bearing: 30, duration_ms: 0 }
export const FACT = {
  fact_id: "f_test_distance_a",
  characteristic_key: "distance_to_sea",
  value: 6,
  unit: "min",
  label: "6 min to the sea",
  confidence: 0.86,
  source_type: "computed",
  status: "active",
  geo_refs: ["gf_route"],
  explanation: "Route computed from open pedestrian paths.",
  provenance: {
    source_type: "computed",
    confidence: 0.86,
    computed_at: "2026-10-25T00:00:00Z",
    source_url: "https://www.openstreetmap.org/",
    evidence: [{ kind: "param", text: "Test route length: 480 m" }],
  },
}
export const HOTELS = [
  {
    id: "h_test_a",
    name: "Test hotel A",
    location: [39.72, 43.58],
    address: "Test address A",
    levels: 6,
  },
  {
    id: "h_test_b",
    name: "Test hotel B",
    location: [39.721, 43.581],
    address: "Test address B",
    levels: 4,
  },
]
function dynamicKind(path: string): string {
  if (path.endsWith("/scene")) return "scene"
  if (path.endsWith("/confirm")) return "confirm"
  if (path.endsWith("/correct")) return "correct"
  if (path.endsWith("/answer")) return "answer"
  if (path.startsWith("/hotelier/")) return "questions"
  if (path.includes("/facts/")) return "fact"
  return "hotel"
}

export async function installHotelContract(page: Page) {
  const calls = { searches: 0, answers: 0, confirmed: 0, corrected: 0, batches: 0 }
  await page.addInitScript(() => {
    localStorage.setItem("app-theme", "dark")
    localStorage.setItem("app-locale", "ru")
  })
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "")
    const hotel = HOTELS.find((item) => path.includes(item.id)) ?? HOTELS[0]
    if (path === "/health" || path === "/characteristics") {
      await route.continue()
      return
    }
    const kind = ["/regions", "/search", "/geo-features:batch", "/compare"].includes(path)
      ? path
      : dynamicKind(path)
    const responses: Readonly<Record<string, () => unknown>> = {
      "/regions": () => ({
        items: [{ id: "test", name: "Test region", default_camera: CAMERA }],
      }),
      "/search": () => {
        calls.searches++
        return {
          query_id: "test_query",
          parsed: {
            intents: [{ characteristic_key: "distance_to_sea", source_text: "to the sea" }],
          },
          results: HOTELS.map((item) => ({
            hotel: item,
            score: 0.8,
            camera: CAMERA,
            matched: [
              {
                characteristic_key: "distance_to_sea",
                match: "full",
                label: FACT.label,
                fact: FACT,
                geo_refs: ["gf_route"],
              },
            ],
          })),
        }
      },
      scene: () => ({
        hotel_id: hotel?.id,
        cameras: { overview: CAMERA, best_match: CAMERA },
        building: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [39.7198, 43.5798],
                    [39.7202, 43.5798],
                    [39.7202, 43.5802],
                    [39.7198, 43.5802],
                    [39.7198, 43.5798],
                  ],
                ],
              },
              properties: { height_m: 18, is_hotel: true },
            },
          ],
        },
        facades: [],
      }),
      "/geo-features:batch": () => {
        calls.batches++
        return {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              id: "gf_route",
              geometry: {
                type: "LineString",
                coordinates: [
                  [39.72, 43.58],
                  [39.723, 43.582],
                ],
              },
              properties: { kind: "route" },
            },
          ],
        }
      },
      "/compare": () => ({
        characteristic_keys: ["distance_to_sea"],
        rows: HOTELS.map((item) => ({ hotel_id: item.id, cells: { distance_to_sea: FACT } })),
      }),
      confirm: () => {
        calls.confirmed++
        return { ...FACT, status: "confirmed_by_hotelier" }
      },
      correct: () => {
        calls.corrected++
        return { ...FACT, value: route.request().postDataJSON().value }
      },
      answer: () => {
        calls.answers++
        return { question_id: "q_test", extracted: [FACT], conflicts: [] }
      },
      questions: () => ({
        items: calls.answers
          ? []
          : [
              {
                id: "q_test",
                hotel_id: "h_test_a",
                text: "Which rooms face west?",
                reason: "missing",
                status: "open",
              },
            ],
      }),
      fact: () => ({ ...FACT, history: [] }),
      hotel: () => ({ hotel, facts: [FACT], rooms: [] }),
    }
    const body = responses[kind]?.()
    await route.fulfill({ json: body })
  })
  return calls
}

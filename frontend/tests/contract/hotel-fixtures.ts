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
  const calls = {
    searches: 0,
    answers: 0,
    confirmed: 0,
    corrected: 0,
    batches: 0,
    compared: [] as string[],
  }
  const chatMessages: { id: string; role: string; content: string; created_at: string }[] = []
  await page.addInitScript(() => {
    localStorage.setItem("app-theme", "dark")
    localStorage.setItem("app-locale", "ru")
  })
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "")
    const hotel = HOTELS.find((item) => path.includes(item.id)) ?? HOTELS[0]
    if (
      path === "/health" ||
      path === "/characteristics" ||
      path.startsWith("/map/") ||
      path.startsWith("/weather")
    ) {
      await route.continue()
      return
    }
    const kind = [
      "/regions",
      "/search",
      "/chat/messages",
      "/geo-features:batch",
      "/compare",
    ].includes(path)
      ? path
      : path.startsWith("/chat/conversations/")
        ? "conversation"
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
                explanation: FACT.explanation,
                fact: FACT,
                geo_refs: ["gf_route"],
              },
            ],
          })),
        }
      },
      "/chat/messages": () => {
        const message = String(route.request().postDataJSON().message)
        chatMessages.push({
          id: `u-${chatMessages.length}`,
          role: "user",
          content: message,
          created_at: new Date().toISOString(),
        })
        chatMessages.push({
          id: `a-${chatMessages.length}`,
          role: "assistant",
          content: "Found two hotels.",
          created_at: new Date().toISOString(),
        })
        return {
          id: "00000000-0000-0000-0000-000000000001",
          messages: chatMessages,
          effective_query: message,
          search: responses["/search"]?.(),
        }
      },
      conversation: () => ({
        id: "00000000-0000-0000-0000-000000000001",
        messages: chatMessages,
        effective_query: chatMessages.at(-2)?.content,
        search: responses["/search"]?.(),
      }),
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
      "/compare": () => {
        calls.compared = route.request().postDataJSON().hotel_ids
        return {
          characteristic_keys: ["distance_to_sea"],
          rows: HOTELS.map((item) => ({ hotel_id: item.id, cells: { distance_to_sea: FACT } })),
        }
      },
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
                characteristic_key: "sunset_view",
                text: "Which rooms face west?",
                reason: "missing",
                status: "open",
                created_at: "2026-10-25T00:00:00Z",
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

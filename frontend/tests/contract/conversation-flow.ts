import type { Page, Route } from "@playwright/test"
import type { Conversation } from "@/features/hotel-search"

const ID = "00000000-0000-0000-0000-000000000019"

export function conversationFixture(hotels: boolean, version = 1): Conversation {
  return {
    id: ID,
    title: "Test conversation",
    updated_at: null,
    messages: [
      { id: `u-${version}`, role: "user", content: "Request", created_at: "2026-10-27T00:00:00Z" },
      {
        id: `a-${version}`,
        role: "assistant",
        content: "Response",
        created_at: "2026-10-27T00:00:01Z",
      },
    ],
    search_message_id: `a-${version}`,
    search: {
      query_id: `q-${version}`,
      parsed: { location_hint: "Sochi" },
      results: hotels
        ? [
            {
              hotel: { id: "h_test_a", name: "Test hotel A", location: [39.72, 43.58] },
              matched: [],
              score: 0,
            },
          ]
        : [],
    },
  }
}

export async function installConversationFlow(page: Page) {
  const pending: Route[] = []
  const requests: string[] = []
  let current = conversationFixture(false)
  await page.route("**/api/v1/chat/messages", async (route) => {
    requests.push(String(route.request().postDataJSON().message))
    pending.push(route)
  })
  await page.route("**/api/v1/chat/conversations/*", (route) => route.fulfill({ json: current }))
  return {
    pending,
    requests,
    get posts() {
      return requests.length
    },
    respond: async (response: Conversation) => {
      current = response
      const route = pending.shift()
      if (!route) throw new Error("Expected pending chat request")
      await route.fulfill({ json: response })
    },
    fail: async () => {
      const route = pending.shift()
      if (!route) throw new Error("Expected pending chat request")
      await route.fulfill({
        status: 503,
        json: { code: "model_failure", message: "Controlled failure" },
      })
    },
  }
}

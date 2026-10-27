import { describe, expect, it } from "vitest"
import {
  readWorkspaceLocation,
  safeWorkspaceReturn,
  workspaceHref,
  workspaceSurface,
} from "@/features/hotel-search/workspace-location"

describe("workspace addresses", () => {
  it("distinguishes landing, conversation, workspace and the two hotel surfaces", () => {
    const route = readWorkspaceLocation("/", "")
    expect(workspaceSurface(route, false, false)).toBe("landing")
    expect(workspaceSurface(route, true, false)).toBe("conversation")
    expect(workspaceSurface(route, true, true)).toBe("workspace")
    expect(workspaceSurface({ ...route, hotel: "h1" }, true, true)).toBe("hotel-panel")
    expect(workspaceSurface({ ...route, fullMap: true }, true, true)).toBe("map")
    expect(workspaceSurface({ ...route, hotelPage: true, hotel: "h1" }, true, true)).toBe(
      "hotel-page",
    )
  })
  it.each([
    "/?chat=chat-a",
    "/?chat=chat-a&hotel=w123",
    "/?chat=chat-a&hotel=w123&map=full",
    "/hotels/w123?chat=chat-a&from=map&section=offers&style=toy-town",
  ])("round-trips %s without losing context", (href) => {
    const url = new URL(href, "https://example.test")
    expect(workspaceHref(readWorkspaceLocation(url.pathname, url.search))).toBe(href)
  })
  it("normalizes unknown values and unsafe identifiers", () => {
    const route = readWorkspaceLocation(
      "/",
      "?chat=../../bad&hotel=w123&map=wide&style=unknown&tab=other&injected=yes",
    )
    expect(workspaceHref(route)).toBe("/?hotel=w123")
  })
  it.each(["https://evil.test/", "//evil.test/", "/hotelier/h1", "javascript:alert(1)"])(
    "rejects external or foreign return path %s",
    (href) => {
      expect(safeWorkspaceReturn(href)).toBeUndefined()
    },
  )
  it("keeps hotel-page return information and normalizes its query", () => {
    expect(safeWorkspaceReturn("/hotels/w123?from=map&unknown=1")).toBe("/hotels/w123?from=map")
  })
})

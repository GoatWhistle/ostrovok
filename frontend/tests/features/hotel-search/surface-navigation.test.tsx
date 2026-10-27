import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { MemoryRouter, useLocation } from "react-router"
import { describe, expect, it } from "vitest"
import { useWorkspaceNavigation } from "../../../src/features/hotel-search/use-workspace-navigation"

function mount(path: string) {
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
  )
  return renderHook(() => ({ navigation: useWorkspaceNavigation(), location: useLocation() }), {
    wrapper,
  })
}
describe("hotel surface origins", () => {
  it("unwinds hotel page to full map to the original panel and keeps the selected appearance", () => {
    const state = mount("/?chat=conversation&hotel=hotel-a&tab=hotels&style=neon")
    act(() => state.result.current.navigation.expandMap())
    act(() => state.result.current.navigation.openHotelPage("hotel-a"))
    expect(state.result.current.location.pathname).toBe("/hotels/hotel-a")
    act(() => state.result.current.navigation.setAppearance("toy-town"))
    act(() => state.result.current.navigation.returnFromSurface())
    expect(state.result.current.navigation.route.fullMap).toBe(true)
    expect(state.result.current.navigation.route.appearance).toBe("toy-town")
    act(() => state.result.current.navigation.returnFromSurface())
    expect(state.result.current.navigation.route.fullMap).toBe(false)
    expect(state.result.current.navigation.route.hotel).toBe("hotel-a")
    expect(state.result.current.navigation.route.tab).toBe("hotels")
    expect(state.result.current.navigation.route.appearance).toBe("toy-town")
  })
  it("keeps a hotel selected on the large map when returning to the panel", () => {
    const state = mount("/?chat=conversation&hotel=hotel-a&tab=hotels")
    act(() => state.result.current.navigation.expandMap())
    act(() => state.result.current.navigation.selectHotel("hotel-b"))
    act(() => state.result.current.navigation.returnFromSurface())
    expect(state.result.current.navigation.route.hotel).toBe("hotel-b")
    expect(state.result.current.navigation.route.fullMap).toBe(false)
  })
  it("returns a direct hotel link to the landing without leaving the application", () => {
    const state = mount("/hotels/hotel-a")
    act(() => state.result.current.navigation.returnFromSurface())
    expect(state.result.current.location.pathname).toBe("/")
    expect(state.result.current.navigation.route.hotel).toBeUndefined()
    expect(state.result.current.navigation.started).toBe(false)
  })
  it("uses the URL origin when a hotel page was opened directly from a map link", () => {
    const state = mount("/hotels/hotel-a?from=map&style=toy-town")
    act(() => state.result.current.navigation.returnFromSurface())
    expect(state.result.current.navigation.route.fullMap).toBe(true)
    expect(state.result.current.navigation.route.hotel).toBe("hotel-a")
  })
  it("returns from the minimap's large map to the same hotel page for scroll restoration", () => {
    const state = mount("/?chat=conversation&hotel=hotel-a&tab=hotels")
    act(() => state.result.current.navigation.openHotelPage("hotel-a"))
    expect(state.result.current.navigation.restoring).toBe(false)
    expect(state.result.current.navigation.returnToHotel).toBe(false)
    act(() => state.result.current.navigation.expandMap())
    expect(state.result.current.navigation.route.fullMap).toBe(true)
    expect(state.result.current.navigation.route.hotel).toBe("hotel-a")
    expect(state.result.current.navigation.returnToHotel).toBe(true)
    act(() => state.result.current.navigation.returnFromSurface())
    expect(state.result.current.location.pathname).toBe("/hotels/hotel-a")
    expect(state.result.current.navigation.restoring).toBe(true)
    expect(state.result.current.navigation.returnToHotel).toBe(false)
    act(() => state.result.current.navigation.returnFromSurface())
    expect(state.result.current.location.pathname).toBe("/")
    expect(state.result.current.navigation.route.hotel).toBe("hotel-a")
    expect(state.result.current.navigation.route.fullMap).toBe(false)
  })
})

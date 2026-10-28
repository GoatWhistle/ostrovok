import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it } from "vitest"
import {
  HotelStayProvider,
  useHotelStay,
} from "../../../../src/entities/hotel/hotel-stay/hotel-stay"

describe("shared hotel stay", () => {
  it("keeps date edits shared between result list and selected hotel", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <HotelStayProvider stay={{ check_in: "2026-11-02", check_out: "2026-11-04", adults: 2 }}>
        {children}
      </HotelStayProvider>
    )
    const state = renderHook(() => ({ list: useHotelStay(), detail: useHotelStay() }), { wrapper })
    act(() => {
      state.result.current.list.update({ checkIn: "2026-11-05" })
      state.result.current.list.update({ checkOut: "2026-11-07" })
    })
    expect(state.result.current.detail.value).toEqual({
      checkIn: "2026-11-05",
      checkOut: "2026-11-07",
      adults: 2,
    })
    act(() => state.result.current.detail.update({ adults: 3 }))
    expect(state.result.current.list.value.adults).toBe(3)
  })
  it("does not invent dates or guests when the query omits them", () => {
    const state = renderHook(() => useHotelStay())
    expect(state.result.current.value).toEqual({ checkIn: "", checkOut: "", adults: 0 })
  })
})

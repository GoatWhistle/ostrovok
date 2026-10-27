import { render, waitFor } from "@testing-library/react"
import { expect, it, vi } from "vitest"
import { useHotelSection } from "@/pages/home/full-hotel/use-hotel-section"

function Content({ loaded }: { readonly loaded: boolean }) {
  const ref = useHotelSection("hotel-a", "offers")
  return <section ref={ref}>{loaded ? <section id="hotel-a-rooms" tabIndex={-1} /> : null}</section>
}

it("focuses rooms after asynchronous detail content becomes available", async () => {
  const scroll = vi.fn()
  HTMLElement.prototype.scrollIntoView = scroll
  const view = render(<Content loaded={false} />)
  view.rerender(<Content loaded />)
  await waitFor(() => expect(document.activeElement?.id).toBe("hotel-a-rooms"))
  expect(scroll).toHaveBeenCalledWith({ block: "start" })
})

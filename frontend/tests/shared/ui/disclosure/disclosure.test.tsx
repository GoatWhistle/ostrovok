import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Disclosure } from "../../../../src/shared/ui/layout/disclosure/disclosure"

const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView")
afterEach(() => {
  if (descriptor) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", descriptor)
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView")
})

function scrollSpy() {
  const scroll = vi.fn()
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scroll,
  })
  return scroll
}

describe("disclosure reveal", () => {
  it("keeps an icon-only trigger named and exposes the reverse action", async () => {
    render(
      <Disclosure title="Show places" expandedTitle="Hide places" iconOnly>
        <p>Details</p>
      </Disclosure>,
    )
    const button = screen.getByRole("button", { name: "Show places" })
    expect(button.getAttribute("title")).toBe("Show places")
    await userEvent.click(button)
    expect(screen.getByRole("button", { name: "Hide places" }).getAttribute("aria-expanded")).toBe(
      "true",
    )
  })

  it("delegates a controlled disclosure change to its owner", async () => {
    const change = vi.fn()
    const { rerender } = render(
      <Disclosure title="Category" open onOpenChange={change}>
        <p>Details</p>
      </Disclosure>,
    )
    await userEvent.click(screen.getByRole("button", { name: "Category" }))
    expect(change).toHaveBeenCalledWith(false)
    rerender(
      <Disclosure title="Category" open={false} onOpenChange={change}>
        <p>Details</p>
      </Disclosure>,
    )
    expect(screen.getByRole("button", { name: "Category" }).getAttribute("aria-expanded")).toBe(
      "false",
    )
  })

  it("scrolls to newly opened evidence once and keeps the same trigger usable to close it", async () => {
    const scroll = scrollSpy()
    render(
      <Disclosure title="Evidence" revealOnOpen>
        <p>Details</p>
      </Disclosure>,
    )
    const button = screen.getByRole("button", { name: "Evidence" })
    expect(scroll).not.toHaveBeenCalled()
    await userEvent.click(button)
    expect(scroll).toHaveBeenCalledExactlyOnceWith({ block: "start", behavior: "instant" })
    expect(screen.getByText("Details")).toBeTruthy()
    await userEvent.click(button)
    expect(button.getAttribute("aria-expanded")).toBe("false")
    expect(scroll).toHaveBeenCalledTimes(1)
  })

  it("does not move the page when another disclosure opens without reveal enabled", async () => {
    const scroll = scrollSpy()
    render(
      <Disclosure title="Description">
        <p>Details</p>
      </Disclosure>,
    )
    await userEvent.click(screen.getByRole("button", { name: "Description" }))
    expect(scroll).not.toHaveBeenCalled()
  })
})

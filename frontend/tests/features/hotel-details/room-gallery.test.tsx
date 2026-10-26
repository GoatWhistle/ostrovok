import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { RoomGallery } from "../../../src/features/hotel-details/rooms/room-gallery"
import ru from "../../../src/shared/i18n/locales/ru/explore.json"

describe("room gallery", () => {
  it("moves only through the selected room photos and stops at the bounds", async () => {
    render(
      <RoomGallery
        photos={["https://cdn.ostrovok.ru/room-a.jpg", "https://cdn.ostrovok.ru/room-b.jpg"]}
        name="Room"
      />,
    )
    expect(screen.getByRole("img").getAttribute("src")).toContain("room-a.jpg")
    expect(
      screen.getByRole("button", { name: ru.rooms.previousPhoto }).hasAttribute("disabled"),
    ).toBe(true)
    await userEvent.click(screen.getByRole("button", { name: ru.rooms.nextPhoto }))
    expect(screen.getByRole("img").getAttribute("src")).toContain("room-b.jpg")
    expect(screen.getByRole("button", { name: ru.rooms.nextPhoto }).hasAttribute("disabled")).toBe(
      true,
    )
    await userEvent.click(screen.getByRole("button", { name: ru.rooms.previousPhoto }))
    expect(screen.getByRole("img").getAttribute("src")).toContain("room-a.jpg")
  })
  it("shows missing photos without substituting a hotel photo", () => {
    render(<RoomGallery photos={[]} name="Room" />)
    expect(screen.queryByRole("img")).toBeNull()
    expect(screen.getByText(ru.rooms.noPhotos)).toBeTruthy()
  })
  it("reports a broken photo and allows moving to the next one", async () => {
    render(
      <RoomGallery
        photos={["https://cdn.ostrovok.ru/missing.jpg", "https://cdn.ostrovok.ru/room.jpg"]}
        name="Room"
      />,
    )
    fireEvent.error(screen.getByRole("img"))
    expect(screen.getByText(ru.rooms.photoError)).toBeTruthy()
    await userEvent.click(screen.getByRole("button", { name: ru.rooms.nextPhoto }))
    expect(screen.getByRole("img").getAttribute("src")).toContain("room.jpg")
  })
})

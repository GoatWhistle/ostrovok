import { createContext, type ReactNode, useContext, useState } from "react"

type RoomControl = {
  get: (key: string) => string | undefined
  select: (key: string, room: string | undefined) => void
}
const Context = createContext<RoomControl | null>(null)

export function HotelRoomProvider({
  scope,
  children,
}: {
  readonly scope: string
  readonly children: ReactNode
}) {
  const [rooms, setRooms] = useState<ReadonlyMap<string, string | undefined>>(() => new Map())
  return (
    <Context
      value={{
        get: (key) => rooms.get(`${scope}:${key}`),
        select: (key, room) => setRooms((values) => new Map(values).set(`${scope}:${key}`, room)),
      }}
    >
      {children}
    </Context>
  )
}
export function useHotelRoom(hotel: string, checkIn: string, checkOut: string, adults: number) {
  const shared = useContext(Context)
  const local = useState<string>()
  const key = JSON.stringify([hotel, checkIn, checkOut, adults])
  return shared
    ? ([shared.get(key), (room: string | undefined) => shared.select(key, room)] as const)
    : local
}

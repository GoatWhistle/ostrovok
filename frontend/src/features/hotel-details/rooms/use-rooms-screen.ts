import { useEffect, useRef, useState } from "react"

export function useRoomsScreen(hotelId: string | undefined) {
  const [roomsFor, setRoomsFor] = useState<string>()
  const open = roomsFor !== undefined && roomsFor === hotelId
  const top = useRef<HTMLElement>(null)
  const shown = useRef(open)
  useEffect(() => {
    if (shown.current !== open) top.current?.scrollIntoView({ block: "start" })
    shown.current = open
  }, [open])
  return {
    open,
    top,
    show: () => setRoomsFor(hotelId),
    hide: () => setRoomsFor(undefined),
  }
}

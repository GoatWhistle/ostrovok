import { createContext, type ReactNode, useContext, useState } from "react"
import type { components } from "@/shared/api/schema.gen"

type Parsed = components["schemas"]["SearchResponse"]["parsed"]
type Stay = { checkIn: string; checkOut: string; adults: number }
export type StayContext = { value: Stay; update: (change: Partial<Stay>) => void }
const Context = createContext<StayContext | null>(null)

function initial(stay: Parsed | undefined): Stay {
  return {
    checkIn: stay?.check_in ?? "",
    checkOut: stay?.check_out ?? "",
    adults: stay?.adults ?? 0,
  }
}

export function HotelStayProvider({
  stay,
  children,
}: {
  readonly stay?: Parsed | undefined
  readonly children: ReactNode
}) {
  const [value, setValue] = useState(() => initial(stay))
  return (
    <Context
      value={{ value, update: (change) => setValue((current) => ({ ...current, ...change })) }}
    >
      {children}
    </Context>
  )
}

export function useHotelStay(stay?: Parsed) {
  const shared = useContext(Context)
  const [value, setValue] = useState(() => initial(stay))
  return (
    shared ?? {
      value,
      update: (change: Partial<Stay>) => setValue((current) => ({ ...current, ...change })),
    }
  )
}

import { useEffect, useRef } from "react"
import { revealTransition } from "@/shared/motion"
import { type Theme, useTheme } from "@/shared/theme"

const DAY_ALTITUDE = 3
const NIGHT_ALTITUDE = -6

export function sunTheme(altitude: number, current: Theme): Theme {
  if (altitude >= DAY_ALTITUDE) return "light"
  if (altitude <= NIGHT_ALTITUDE) return "dark"
  return current
}

export function useSunTheme(altitude: number, moment: string): void {
  const { theme, setTheme } = useTheme()
  const latest = useRef({ theme, setTheme })
  latest.current = { theme, setTheme }
  const seen = useRef(moment)
  useEffect(() => {
    if (seen.current === moment) return
    seen.current = moment
    const next = sunTheme(altitude, latest.current.theme)
    if (next === latest.current.theme) return
    void revealTransition("dusk", () => latest.current.setTheme(next))
  }, [altitude, moment])
}

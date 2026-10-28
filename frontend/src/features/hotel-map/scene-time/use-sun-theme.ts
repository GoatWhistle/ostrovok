import { useEffect, useRef } from "react"
import { revealTransition } from "@/shared/motion"
import { currentTheme, type Theme, useSetTheme } from "@/shared/theme"

const DAY_ALTITUDE = 3
const NIGHT_ALTITUDE = -6

export function sunTheme(altitude: number, current: Theme): Theme {
  if (altitude >= DAY_ALTITUDE) return "light"
  if (altitude <= NIGHT_ALTITUDE) return "dark"
  return current
}

export function useSunTheme(altitude: number, moment: string): void {
  const setTheme = useSetTheme()
  const seen = useRef(moment)
  useEffect(() => {
    if (seen.current === moment) return
    seen.current = moment
    const current = currentTheme()
    const next = sunTheme(altitude, current)
    if (next === current) return
    void revealTransition("dusk", () => setTheme(next))
  }, [altitude, moment, setTheme])
}

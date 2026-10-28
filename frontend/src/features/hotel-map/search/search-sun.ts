import { OVERVIEW_SUN } from "../scene-time/scene-time"

export function displaySun(
  sending: boolean | undefined,
  selected: boolean,
  sun: typeof OVERVIEW_SUN | { azimuth: number; altitude: number },
) {
  if (sending || !selected) return OVERVIEW_SUN
  return sun
}

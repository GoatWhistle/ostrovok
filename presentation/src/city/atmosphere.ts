import { Color } from "three"
import { token } from "./palette"
import { smoothstep, sunAt } from "./sun"

export interface Atmosphere {
  readonly night: number
  readonly sunDirection: readonly [number, number, number]
  readonly sunColor: Color
  readonly sunIntensity: number
  readonly ambientSky: Color
  readonly ambientGround: Color
  readonly ambientIntensity: number
  readonly zenith: Color
  readonly horizon: Color
  readonly glow: Color
  readonly glowStrength: number
  readonly sea: Color
  readonly seaDeep: Color
  readonly fog: Color
}

const mix = (a: Color, b: Color, t: number) => a.clone().lerp(b, t)

export function atmosphereAt(hour: number): Atmosphere {
  const sun = sunAt(hour)
  const altitude = sun.altitude
  const day = smoothstep(-6, 12, altitude)
  const golden = smoothstep(18, 2, altitude) * smoothstep(-7, 1, altitude)
  const night = 1 - smoothstep(-9, -1, altitude)
  const elevation = (Math.max(altitude, 4) * Math.PI) / 180
  const azimuth = (sun.azimuth * Math.PI) / 180
  const sunDirection = [
    Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
    -Math.cos(azimuth) * Math.cos(elevation),
  ] as const
  const skyDay = token("--map-toy-sky")
  const skyDusk = token("--map-toy-sky-dusk")
  const skyNight = token("--map-toy-sky-night")
  const zenithDay = new Color("#8fbbe0")
  const zenithNight = new Color("#3a5578")
  const horizon = mix(mix(skyNight.clone().lerp(skyDay, 0.25), skyDay, day), skyDusk, golden * 0.85)
  const zenith = mix(mix(zenithNight, zenithDay, day), new Color("#7c8fb8"), golden * 0.35)
  const sunColor = mix(token("--map-toy-sun"), token("--map-toy-sun-low"), golden)
  const sea = mix(mix(token("--map-toy-sea-night"), token("--map-toy-water"), day), token("--map-toy-sea-dusk"), golden * 0.6)
  return {
    night,
    sunDirection,
    sunColor,
    sunIntensity: 2.1 * smoothstep(-2, 10, altitude) + 0.15,
    ambientSky: mix(new Color("#7f9cc4"), new Color("#ffffff"), day),
    ambientGround: mix(new Color("#3a4658"), new Color("#d9cfbd"), day),
    ambientIntensity: 0.95 + day * 0.65,
    zenith,
    horizon,
    glow: mix(token("--map-toy-sun"), token("--map-toy-glow"), golden),
    glowStrength: smoothstep(-6, 2, altitude) * (0.35 + golden * 0.9),
    sea,
    seaDeep: sea.clone().multiplyScalar(0.82),
    fog: horizon.clone(),
  }
}

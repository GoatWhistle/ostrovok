import type { SunPosition } from "@/shared/geo/terrain"

export interface ShotCamera {
  readonly center: readonly [number, number]
  readonly zoom: number
  readonly pitch: number
  readonly bearing: number
}

export interface Shot {
  readonly id: string
  readonly from: ShotCamera
  readonly to: ShotCamera
  readonly sun: SunPosition
  readonly pins: readonly (readonly [number, number])[]
}

const MORNING = { azimuth: 105, altitude: 12 }
const DAY = { azimuth: 200, altitude: 38 }
const GOLDEN = { azimuth: 250, altitude: 9 }
const DUSK = { azimuth: 285, altitude: 2 }

export const SHOTS: readonly Shot[] = [
  {
    id: "elbrus",
    from: { center: [42.405, 43.318], zoom: 11.6, pitch: 64, bearing: 20 },
    to: { center: [42.425, 43.33], zoom: 11.9, pitch: 66, bearing: 48 },
    sun: MORNING,
    pins: [],
  },
  {
    id: "port",
    from: { center: [39.7196, 43.5812], zoom: 15.4, pitch: 58, bearing: -38 },
    to: { center: [39.7206, 43.5822], zoom: 15.8, pitch: 62, bearing: -8 },
    sun: DAY,
    pins: [
      [39.7188, 43.5809],
      [39.7232, 43.5848],
    ],
  },
  {
    id: "klyuchevskaya",
    from: { center: [160.52, 56.0], zoom: 10.6, pitch: 62, bearing: 60 },
    to: { center: [160.55, 56.02], zoom: 10.9, pitch: 64, bearing: 92 },
    sun: DUSK,
    pins: [],
  },
  {
    id: "mountains",
    from: { center: [40.276, 43.668], zoom: 12.4, pitch: 62, bearing: 140 },
    to: { center: [40.286, 43.671], zoom: 12.7, pitch: 64, bearing: 168 },
    sun: GOLDEN,
    pins: [
      [40.2975, 43.6718],
      [40.3108, 43.6645],
    ],
  },
  {
    id: "avacha",
    from: { center: [158.72, 53.13], zoom: 10.8, pitch: 60, bearing: 330 },
    to: { center: [158.74, 53.15], zoom: 11.1, pitch: 62, bearing: 356 },
    sun: DAY,
    pins: [],
  },
  {
    id: "olympic",
    from: { center: [39.9546, 43.4048], zoom: 14.8, pitch: 58, bearing: 18 },
    to: { center: [39.9556, 43.4058], zoom: 15.2, pitch: 62, bearing: 48 },
    sun: GOLDEN,
    pins: [
      [39.9558, 43.4022],
      [39.952, 43.4085],
    ],
  },
  {
    id: "belukha",
    from: { center: [86.56, 49.76], zoom: 11.2, pitch: 64, bearing: 0 },
    to: { center: [86.575, 49.775], zoom: 11.5, pitch: 66, bearing: 30 },
    sun: MORNING,
    pins: [],
  },
  {
    id: "coast",
    from: { center: [39.862, 43.512], zoom: 13.2, pitch: 62, bearing: 58 },
    to: { center: [39.868, 43.516], zoom: 13.5, pitch: 64, bearing: 84 },
    sun: DUSK,
    pins: [[39.8598, 43.5155]],
  },
  {
    id: "khibiny",
    from: { center: [33.62, 67.68], zoom: 11.2, pitch: 62, bearing: 200 },
    to: { center: [33.64, 67.69], zoom: 11.5, pitch: 64, bearing: 228 },
    sun: GOLDEN,
    pins: [],
  },
]

export function cameraOptions(camera: ShotCamera) {
  return {
    center: [camera.center[0], camera.center[1]] as [number, number],
    zoom: camera.zoom,
    pitch: camera.pitch,
    bearing: camera.bearing,
  }
}

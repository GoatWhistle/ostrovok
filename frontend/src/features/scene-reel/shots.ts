import type { SunPosition } from "@/shared/geo/terrain"
import type { MessageKey } from "@/shared/i18n"

export interface ShotCamera {
  readonly center: readonly [number, number]
  readonly zoom: number
  readonly pitch: number
  readonly bearing: number
}

export interface ShotMark {
  readonly name: MessageKey
  readonly at: readonly [number, number]
}

export interface Shot {
  readonly id: string
  readonly from: ShotCamera
  readonly to: ShotCamera
  readonly sun: SunPosition
  readonly marks: readonly ShotMark[]
}

interface Place {
  readonly id: string
  readonly name: MessageKey
  readonly at: readonly [number, number]
  readonly bearing: number
  readonly distanceKm: number
  readonly zoom: number
  readonly sun: SunPosition
}

const MORNING = { azimuth: 105, altitude: 12 }
const DAY = { azimuth: 200, altitude: 38 }
const GOLDEN = { azimuth: 250, altitude: 9 }
const DUSK = { azimuth: 285, altitude: 2 }

const PITCH = 62
const PITCH_DRIFT = 3
const BEARING_DRIFT = 34
const ZOOM_DRIFT = 0.4
const KM_PER_DEGREE = 111.32

const PLACES: readonly Place[] = [
  {
    id: "elbrus",
    name: "explore:landing.places.elbrus",
    at: [42.43784, 43.35241],
    bearing: 20,
    distanceKm: 5,
    zoom: 11.6,
    sun: MORNING,
  },
  {
    id: "seaport",
    name: "explore:landing.places.seaport",
    at: [39.71117, 43.57959],
    bearing: -38,
    distanceKm: 0.5,
    zoom: 15.4,
    sun: DAY,
  },
  {
    id: "klyuchevskaya",
    name: "explore:landing.places.klyuchevskaya",
    at: [160.6423, 56.05642],
    bearing: 60,
    distanceKm: 12,
    zoom: 10.6,
    sun: DUSK,
  },
  {
    id: "tyatya",
    name: "explore:landing.places.tyatya",
    at: [146.25308, 44.35371],
    bearing: 330,
    distanceKm: 8,
    zoom: 11,
    sun: DAY,
  },
  {
    id: "avachinsky",
    name: "explore:landing.places.avachinsky",
    at: [158.83684, 53.25559],
    bearing: 10,
    distanceKm: 12,
    zoom: 10.8,
    sun: DAY,
  },
  {
    id: "dombay",
    name: "explore:landing.places.dombay",
    at: [41.62035, 43.28839],
    bearing: 120,
    distanceKm: 4,
    zoom: 12,
    sun: MORNING,
  },
  {
    id: "fisht",
    name: "explore:landing.places.fisht",
    at: [39.9586, 43.40066],
    bearing: 18,
    distanceKm: 0.6,
    zoom: 14.8,
    sun: GOLDEN,
  },
  {
    id: "belukha",
    name: "explore:landing.places.belukha",
    at: [86.58991, 49.80707],
    bearing: 20,
    distanceKm: 6,
    zoom: 11.2,
    sun: MORNING,
  },
  {
    id: "kronotsky",
    name: "explore:landing.places.kronotsky",
    at: [160.53257, 54.75318],
    bearing: 40,
    distanceKm: 10,
    zoom: 10.8,
    sun: GOLDEN,
  },
  {
    id: "goldenBridge",
    name: "explore:landing.places.goldenBridge",
    at: [131.89675, 43.10907],
    bearing: 200,
    distanceKm: 1.5,
    zoom: 13.6,
    sun: DUSK,
  },
  {
    id: "ergaki",
    name: "explore:landing.places.ergaki",
    at: [93.32, 52.83],
    bearing: 180,
    distanceKm: 5,
    zoom: 11.8,
    sun: DAY,
  },
  {
    id: "khosta",
    name: "explore:landing.places.khosta",
    at: [39.86395, 43.51177],
    bearing: 58,
    distanceKm: 2.5,
    zoom: 13.2,
    sun: DUSK,
  },
  {
    id: "teriberka",
    name: "explore:landing.places.teriberka",
    at: [35.14, 69.165],
    bearing: 0,
    distanceKm: 5,
    zoom: 11.8,
    sun: GOLDEN,
  },
  {
    id: "khibiny",
    name: "explore:landing.places.khibiny",
    at: [33.64, 67.7],
    bearing: 200,
    distanceKm: 4,
    zoom: 11.2,
    sun: GOLDEN,
  },
]

function behind(place: Place): readonly [number, number] {
  const radians = (place.bearing * Math.PI) / 180
  const [lon, lat] = place.at
  const north = (place.distanceKm * Math.cos(radians)) / KM_PER_DEGREE
  const east =
    (place.distanceKm * Math.sin(radians)) / (KM_PER_DEGREE * Math.cos((lat * Math.PI) / 180))
  return [lon - east, lat - north]
}

function shotOf(place: Place): Shot {
  const center = behind(place)
  return {
    id: place.id,
    from: { center, zoom: place.zoom, pitch: PITCH, bearing: place.bearing },
    to: {
      center,
      zoom: place.zoom + ZOOM_DRIFT,
      pitch: PITCH + PITCH_DRIFT,
      bearing: place.bearing + BEARING_DRIFT,
    },
    sun: place.sun,
    marks: [{ name: place.name, at: place.at }],
  }
}

export const SHOTS: readonly Shot[] = PLACES.map(shotOf)

export function cameraOptions(camera: ShotCamera) {
  return {
    center: [camera.center[0], camera.center[1]] as [number, number],
    zoom: camera.zoom,
    pitch: camera.pitch,
    bearing: camera.bearing,
  }
}

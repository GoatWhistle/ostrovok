import { type CameraPath, orbit } from "../city/camera-path"
import { CITY } from "../city/city-data"

const [fishtX, fishtY] = CITY.landmarks.fisht

export const PATHS = {
  cover: {
    shots: [
      { x: -600, y: 300, distance: 620, pitch: 63, bearing: 52 },
      { x: 2400, y: 2700, distance: 620, pitch: 63, bearing: 52 },
    ],
    seconds: 220,
    loop: false,
    drift: true,
  },
  problem: {
    shots: [
      { x: fishtX - 900, y: fishtY + 900, distance: 2300, pitch: 58, bearing: 125 },
      { x: fishtX - 380, y: fishtY + 260, distance: 1100, pitch: 63, bearing: 112 },
      { x: fishtX - 120, y: fishtY + 40, distance: 640, pitch: 66, bearing: 96 },
      { x: fishtX - 40, y: fishtY - 20, distance: 520, pitch: 67, bearing: 70 },
    ],
    seconds: 14,
    loop: false,
  },
  overview: { shots: orbit([200, 500], 300, { distance: 2600, pitch: 50, start: 160, turn: 60 }, 6), seconds: 40, loop: true },
  hero: { shots: orbit([0, 0], 4, { distance: 380, pitch: 60, start: 150 }, 12), seconds: 80, loop: true },
  heroClose: { shots: orbit([0, 0], 4, { distance: 300, pitch: 64, start: 200 }, 12), seconds: 70, loop: true },
  sea: { shots: orbit([-600, -700], 400, { distance: 1800, pitch: 62, start: 230, turn: 90 }, 6), seconds: 40, loop: true },
  final: {
    shots: [
      { x: -900, y: -400, distance: 1300, pitch: 60, bearing: 40 },
      { x: 1600, y: 1900, distance: 1300, pitch: 60, bearing: 40 },
    ],
    seconds: 200,
    loop: false,
    drift: true,
  },
} satisfies Record<string, CameraPath>

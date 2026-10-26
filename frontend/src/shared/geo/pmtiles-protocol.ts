import { addProtocol, removeProtocol } from "maplibre-gl"
import { Protocol } from "pmtiles"

let users = 0

export function retainPmtiles(): () => void {
  if (users === 0) addProtocol("pmtiles", new Protocol().tile)
  users += 1
  let released = false
  return () => {
    if (released) return
    released = true
    users -= 1
    if (users === 0) removeProtocol("pmtiles")
  }
}

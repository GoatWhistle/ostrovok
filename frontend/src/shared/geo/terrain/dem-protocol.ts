import { addProtocol, type RequestParameters } from "maplibre-gl"
import { fetchWithRetry } from "@/shared/api"

const PROTOCOL = "dem-retry"
const PREFIX = `${PROTOCOL}://`

let registered = false

async function loadTile(params: RequestParameters, abort: AbortController) {
  const data = await fetchWithRetry(params.url.slice(PREFIX.length), abort.signal)
  return { data }
}

export function retryingTileUrl(url: string): string {
  if (!registered) {
    addProtocol(PROTOCOL, loadTile)
    registered = true
  }
  return `${PREFIX}${url}`
}

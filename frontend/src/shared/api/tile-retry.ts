const ATTEMPTS = 4
const FIRST_DELAY_MS = 500

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer)
        reject(signal.reason)
      },
      { once: true },
    )
  })
}

function retryable(status: number): boolean {
  return status >= 500 || status === 408 || status === 429
}

export async function fetchWithRetry(
  url: string,
  signal: AbortSignal,
  attempts = ATTEMPTS,
  firstDelayMs = FIRST_DELAY_MS,
): Promise<ArrayBuffer> {
  for (let attempt = 1; ; attempt += 1) {
    let failure: unknown
    try {
      const response = await fetch(url, { signal })
      if (response.ok) return await response.arrayBuffer()
      failure = new Error(`Tile request failed with status ${response.status}`)
      if (!retryable(response.status)) throw failure
    } catch (error) {
      if (signal.aborted || error === failure) throw error
      failure = error
    }
    if (attempt >= attempts) throw failure
    await pause(firstDelayMs * 2 ** (attempt - 1), signal)
  }
}

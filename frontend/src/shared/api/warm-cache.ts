export function warmCache(urls: readonly string[]) {
  const controller = new AbortController()
  const pending = [...urls]
  const worker = async () => {
    while (pending.length && !controller.signal.aborted) {
      const url = pending.shift()
      if (url)
        await fetch(url, { priority: "low", signal: controller.signal }).catch(() => undefined)
    }
  }
  void Promise.all([worker(), worker()])
  return () => controller.abort()
}

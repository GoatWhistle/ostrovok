export function warmCache(urls: readonly string[]) {
  for (const url of urls) void fetch(url, { priority: "low" }).catch(() => undefined)
}

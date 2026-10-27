export class RequestLane {
  private active = 0
  private queue: (() => void)[] = []
  private readonly limit: number
  constructor(limit: number) {
    this.limit = limit
  }

  run<T>(signal: AbortSignal, work: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const abort = () => {
        this.queue = this.queue.filter((item) => item !== start)
        reject(signal.reason ?? new DOMException("Aborted", "AbortError"))
      }
      const start = () => {
        signal.removeEventListener("abort", abort)
        if (signal.aborted) {
          abort()
          return
        }
        this.active += 1
        void Promise.resolve()
          .then(work)
          .then(resolve, reject)
          .finally(() => {
            this.active -= 1
            this.drain()
          })
      }
      if (signal.aborted) {
        abort()
        return
      }
      signal.addEventListener("abort", abort, { once: true })
      this.queue.push(start)
      this.drain()
    })
  }

  private drain() {
    while (this.active < this.limit && this.queue.length) this.queue.shift()?.()
  }
}

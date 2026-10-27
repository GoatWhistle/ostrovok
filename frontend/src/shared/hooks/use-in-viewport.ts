import { useEffect, useRef, useState } from "react"

export function useInViewport() {
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(entry?.isIntersecting ?? false),
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return { ref, visible }
}

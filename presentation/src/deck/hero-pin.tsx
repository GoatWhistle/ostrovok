import { type RefObject, useEffect, useRef } from "react"
import type { CityScene } from "../city/city-scene"
import styles from "./hero-pin.module.css"

export function HeroPin({ city, label }: { readonly city: RefObject<CityScene | null>; readonly label: string }) {
  const pin = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let frame = 0
    const run = () => {
      const scene = city.current
      const element = pin.current
      if (scene && element) {
        const [x, y, height] = scene.heroAnchor()
        const point = scene.project(x, y, height + 6)
        element.style.left = `${(point.x * 100).toFixed(3)}%`
        element.style.top = `${(point.y * 100).toFixed(3)}%`
        element.style.visibility = point.visible ? "visible" : "hidden"
      }
      frame = requestAnimationFrame(run)
    }
    frame = requestAnimationFrame(run)
    return () => cancelAnimationFrame(frame)
  }, [city])
  return (
    <div ref={pin} className={styles.pin}>
      <span className={styles.label}>{label}</span>
      <span className={styles.stem} />
    </div>
  )
}

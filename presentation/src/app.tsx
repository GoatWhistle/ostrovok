import { useCallback, useEffect, useRef, useState } from "react"
import styles from "./app.module.css"
import { CityScene, type Direction } from "./city/city-scene"
import { DeckStage } from "./deck/deck-stage"
import { DeckLogo } from "./deck/logo/deck-logo"
import { SLIDES } from "./deck/slides"
import { useNavigation } from "./deck/use-navigation"

export function App() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const city = useRef<CityScene | null>(null)
  const [ready, setReady] = useState(false)
  const navigation = useNavigation(SLIDES.length)
  const slide = SLIDES[navigation.index] ?? SLIDES[0]
  useEffect(() => {
    if (!canvas.current) return
    const scene = new CityScene(canvas.current)
    city.current = scene
    setReady(true)
    return () => scene.dispose()
  }, [])
  const direct = useCallback((direction: Direction) => city.current?.direct(direction), [])
  useEffect(() => {
    if (ready && slide) direct(slide.direction)
  }, [ready, slide, direct])
  if (!slide) return null
  return (
    <div className={styles.deck} data-hidden={Boolean(slide.direction.hidden)} data-dimmed={Boolean(slide.dimmed)}>
      <canvas ref={canvas} className={styles.canvas} />
      <div className={styles.veil} />
      <DeckStage>
        <div key={`${slide.id}:${navigation.take}`} className={styles.slide}>
          {ready ? slide.render({ direct }) : null}
        </div>
        {slide.bare ? null : (
          <>
            <div className={styles.corner}>
              <DeckLogo size="corner" />
            </div>
            <span className={styles.number}>{navigation.index + 1}</span>
          </>
        )}
      </DeckStage>
    </div>
  )
}

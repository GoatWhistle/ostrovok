import qrcode from "qrcode-generator"
import { useMemo } from "react"
import { COPY } from "../../deck/copy"
import { DeckLogo } from "../../deck/logo/deck-logo"
import styles from "./final-slide.module.css"

const URL = "https://factmap.goatwhistle.ru"
const LABEL = "factmap.goatwhistle.ru"

function useModules() {
  return useMemo(() => {
    const qr = qrcode(0, "H")
    qr.addData(URL)
    qr.make()
    const size = qr.getModuleCount()
    const center = (size - 1) / 2
    const hole = size * 0.13
    const modules: { x: number; y: number; delay: number }[] = []
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        if (!qr.isDark(y, x)) continue
        if (Math.abs(x - center) < hole && Math.abs(y - center) < hole) continue
        const distance = Math.hypot(x - center, y - center) / (size / 2)
        modules.push({ x, y, delay: 1.3 + distance * 0.9 + ((x * 7 + y * 13) % 10) * 0.012 })
      }
    return { size, modules }
  }, [])
}

export function FinalSlide() {
  const { size, modules } = useModules()
  return (
    <section className={styles.slide}>
      <div className={styles.plate}>
        <DeckLogo size="final" />
        <p className={styles.line}>{COPY.final.line}</p>
        <figure className={styles.card}>
          <svg className={styles.qr} viewBox={`-2 -2 ${size + 4} ${size + 4}`} aria-label={LABEL} role="img">
            <rect x={-2} y={-2} width={size + 4} height={size + 4} className={styles.paper} />
            {modules.map((module) => (
              <rect
                key={`${module.x}-${module.y}`}
                x={module.x}
                y={module.y}
                width={1.04}
                height={1.04}
                className={styles.module}
                style={{
                  animationDelay: `${module.delay}s`,
                  transformOrigin: `${module.x + 0.5}px ${module.y + 0.5}px`,
                }}
              />
            ))}
            <g className={styles.center} transform={`translate(${size / 2 - 3.6} ${size / 2 - 3.6}) scale(0.1125)`}>
              <path d="M5 14 22 8v42L5 56Z" className={styles.side} />
              <path d="M25 8l14 6v42l-14-6Z" className={styles.fact} />
              <path d="M42 14 59 8v42l-17 6Z" className={styles.side} />
            </g>
          </svg>
          <figcaption className={styles.caption}>
            <span className={styles.label}>{COPY.final.solution}</span>
            <span className={styles.url}>{LABEL}</span>
          </figcaption>
        </figure>
      </div>
    </section>
  )
}

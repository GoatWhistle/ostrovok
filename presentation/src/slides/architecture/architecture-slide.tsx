import { useEffect, useState, type CSSProperties } from "react"
import { Plug, ShieldCheck } from "lucide-react"
import { COPY } from "../../deck/copy"
import { SlideTitle } from "../../deck/slide-title"
import parts from "../../deck/deck-parts.module.css"
import styles from "./architecture-slide.module.css"

const CX = 720
const CY = 620
const R_CORE = 120
const R_APP = 220
const R_OUTER = 340
const RX = 470
const RY = 395
const HW = 100
const HH = 26
const SEGMENT_FROM = 50
const SEGMENT_TO = 130

const copy = COPY.architecture
const ADAPTERS = Object.values(copy.adapterItems)
const INTERFACES = Object.values(copy.interfaceItems)
const SWAPS = Object.values(copy.swapItems)
const ADAPTER_ANGLES = [144, 180, 216, 252, 288, 324, 0, 36]
const INTERFACE_ANGLES = [75, 105]

type Chip = {
  readonly label: string
  readonly kind: "adapter" | "interface"
  readonly x: number
  readonly y: number
  readonly start: readonly [number, number]
  readonly end: readonly [number, number]
}

const rad = (deg: number) => (deg * Math.PI) / 180

const polar = (r: number, deg: number) =>
  [CX + r * Math.cos(rad(deg)), CY + r * Math.sin(rad(deg))] as const

const arc = (r: number, from: number, to: number, sweep: 0 | 1) => {
  const [x0, y0] = polar(r, from)
  const [x1, y1] = polar(r, to)
  const large = Math.abs(to - from) > 180 ? 1 : 0
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} ${sweep} ${x1} ${y1}`
}

const topArc = (r: number) => `M ${CX - r} ${CY} A ${r} ${r} 0 0 1 ${CX + r} ${CY}`
const bottomArc = (r: number) => `M ${CX - r} ${CY} A ${r} ${r} 0 0 0 ${CX + r} ${CY}`

const makeChip = (label: string, kind: Chip["kind"], angle: number): Chip => {
  const dx = RX * Math.cos(rad(angle))
  const dy = RY * Math.sin(rad(angle))
  const dist = Math.hypot(dx, dy)
  const ux = dx / dist
  const uy = dy / dist
  const box = Math.min(
    Math.abs(ux) > 1e-6 ? HW / Math.abs(ux) : Infinity,
    Math.abs(uy) > 1e-6 ? HH / Math.abs(uy) : Infinity,
  )
  const from = dist - box - 10
  const to = R_APP + 14
  return {
    label,
    kind,
    x: CX + dx,
    y: CY + dy,
    start: [CX + ux * from, CY + uy * from],
    end: [CX + ux * to, CY + uy * to],
  }
}

const CHIPS: readonly Chip[] = [
  ...ADAPTERS.map((label, i) => makeChip(label, "adapter", ADAPTER_ANGLES[i] ?? 0)),
  ...INTERFACES.map((label, i) => makeChip(label, "interface", INTERFACE_ANGLES[i] ?? 90)),
]

const delay = (seconds: number) => ({ "--delay": `${seconds}s` }) as CSSProperties

function useSwap(count: number, startMs: number, stepMs: number) {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    let interval = 0
    const timeout = window.setTimeout(() => {
      interval = window.setInterval(() => setIndex((value) => (value + 1) % count), stepMs)
    }, startMs)
    return () => {
      window.clearTimeout(timeout)
      window.clearInterval(interval)
    }
  }, [count, startMs, stepMs])
  return index
}

function Rings() {
  return (
    <svg className={styles.svg} viewBox="0 0 1920 1080" aria-hidden="true">
      <defs>
        <marker
          id="arch-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 9 5 L 0 9 z" className={styles.arrowHead} />
        </marker>
        <marker
          id="arch-arrow-fact"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 9 5 L 0 9 z" className={styles.arrowHeadFact} />
        </marker>
        <path id="arch-adapters" d={topArc(282)} />
        <path id="arch-interfaces" d={bottomArc(302)} />
        <path id="arch-app" d={topArc(178)} />
        <path id="arch-app-items" d={bottomArc(194)} />
        <radialGradient id="arch-core">
          <stop offset="0%" stopColor="var(--action-primary)" stopOpacity="0.34" />
          <stop offset="100%" stopColor="var(--action-primary)" stopOpacity="0.12" />
        </radialGradient>
      </defs>

      <g className={styles.band} style={delay(1.0)}>
        <circle cx={CX} cy={CY} r={R_OUTER} className={styles.outerFill} />
        <path d={arc(280, SEGMENT_FROM, SEGMENT_TO, 1)} className={styles.segment} />
        {[SEGMENT_FROM, SEGMENT_TO].map((angle) => {
          const [x0, y0] = polar(R_APP, angle)
          const [x1, y1] = polar(R_OUTER, angle)
          return <line key={angle} x1={x0} y1={y0} x2={x1} y2={y1} className={styles.divider} />
        })}
        <text className={styles.ringLabel}>
          <textPath href="#arch-adapters" startOffset="50%" textAnchor="middle">
            {copy.adapters}
          </textPath>
        </text>
        <text className={`${styles.ringLabel} ${styles.ringLabelFact}`}>
          <textPath href="#arch-interfaces" startOffset="50%" textAnchor="middle">
            {copy.interfaces}
          </textPath>
        </text>
      </g>
      <circle cx={CX} cy={CY} r={R_OUTER} pathLength={1} className={styles.stroke} style={delay(0.9)} />

      <g className={styles.band} style={delay(0.6)}>
        <circle cx={CX} cy={CY} r={R_APP} className={styles.appFill} />
        <text className={styles.ringLabel}>
          <textPath href="#arch-app" startOffset="50%" textAnchor="middle">
            {copy.application}
          </textPath>
        </text>
        <text className={styles.ringItems}>
          <textPath href="#arch-app-items" startOffset="50%" textAnchor="middle">
            {copy.applicationItems}
          </textPath>
        </text>
      </g>
      <circle cx={CX} cy={CY} r={R_APP} pathLength={1} className={styles.stroke} style={delay(0.5)} />

      <g className={styles.band} style={delay(0.25)}>
        <circle cx={CX} cy={CY} r={R_CORE} fill="url(#arch-core)" />
        <text x={CX} y={CY - 4} className={styles.coreLabel}>
          {copy.domain}
        </text>
        <text x={CX} y={CY + 30} className={styles.coreItems}>
          {copy.domainItems}
        </text>
      </g>
      <circle
        cx={CX}
        cy={CY}
        r={R_CORE}
        pathLength={1}
        className={`${styles.stroke} ${styles.strokeCore}`}
        style={delay(0.2)}
      />

      {CHIPS.map((chip, i) => (
        <g key={chip.label}>
          <path
            d={`M ${chip.start[0]} ${chip.start[1]} L ${chip.end[0]} ${chip.end[1]}`}
            pathLength={1}
            markerEnd={chip.kind === "interface" ? "url(#arch-arrow-fact)" : "url(#arch-arrow)"}
            className={`${styles.arrow} ${chip.kind === "interface" ? styles.arrowFact : ""}`}
            style={delay(1.75 + i * 0.05)}
          />
          <circle
            r={4.5}
            className={`${styles.dot} ${chip.kind === "interface" ? styles.dotFact : ""}`}
            style={
              {
                "--x0": `${chip.start[0]}px`,
                "--y0": `${chip.start[1]}px`,
                "--x1": `${chip.end[0]}px`,
                "--y1": `${chip.end[1]}px`,
                "--delay": `${2.5 + ((i * 0.37) % 1.6)}s`,
              } as CSSProperties
            }
          />
        </g>
      ))}
    </svg>
  )
}

function SwapCard() {
  const active = useSwap(SWAPS.length, 2600, 2000)
  const previous = (active + SWAPS.length - 1) % SWAPS.length
  return (
    <section className={`${parts.plate} ${styles.card}`}>
      <header className={styles.cardHead}>
        <span className={styles.cardIcon}>
          <Plug size={26} strokeWidth={2} />
        </span>
        <span className={styles.cardTitle}>{copy.swap}</span>
      </header>
      <div className={styles.socket}>
        <span className={styles.pins} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <div className={styles.slot}>
          {SWAPS.map((label, i) => (
            <span
              key={label}
              className={`${styles.plug} ${
                i === active ? styles.plugOn : i === previous ? styles.plugOut : styles.plugWait
              }`}
            >
              {label}
            </span>
          ))}
          <span key={active} className={styles.pulse} aria-hidden="true" />
        </div>
      </div>
      <ol className={styles.options}>
        {SWAPS.map((label, i) => (
          <li key={label} className={i === active ? styles.optionOn : undefined}>
            {label}
          </li>
        ))}
      </ol>
    </section>
  )
}

export function ArchitectureSlide() {
  return (
    <div className={`${parts.slide} ${styles.root}`}>
      <SlideTitle title={copy.title} accent={copy.accent} />
      <div className={styles.diagram}>
        <Rings />
        {CHIPS.map((chip, i) => (
          <span
            key={chip.label}
            className={`${styles.chip} ${chip.kind === "interface" ? styles.chipFact : ""}`}
            style={{ left: chip.x, top: chip.y, ...delay(1.45 + i * 0.05) }}
          >
            {chip.label}
          </span>
        ))}
      </div>
      <aside className={styles.side}>
        <SwapCard />
        <p className={`${parts.plate} ${styles.rule}`}>
          <span className={styles.ruleIcon}>
            <ShieldCheck size={26} strokeWidth={2} />
          </span>
          <span>{copy.rule}</span>
        </p>
      </aside>
    </div>
  )
}

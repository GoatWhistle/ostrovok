import { useEffect, useRef, type CSSProperties } from "react"
import { Database, Layers, Timer, Waves, Zap, type LucideIcon } from "lucide-react"
import { COPY } from "../../deck/copy"
import { SlideTitle } from "../../deck/slide-title"
import parts from "../../deck/deck-parts.module.css"
import styles from "./pipeline-slide.module.css"

const copy = COPY.pipeline
const TOTAL_MS = 3790
const CHART_WIDTH = 1000
const START_S = 0.8
const PLAY_S = 3.4
const SCALE = CHART_WIDTH / TOTAL_MS
const REAL = PLAY_S / TOTAL_MS

type Kind = "tool" | "cache" | "llm" | "wave" | "answer"
type Block = { readonly from: number; readonly to: number; readonly kind: Kind; readonly label?: string }
type Row = {
  readonly id: string
  readonly label: string
  readonly sub?: string
  readonly top: number
  readonly blocks: readonly Block[]
}

const ROWS: readonly Row[] = [
  { id: "route", label: copy.route, top: 0, blocks: [{ from: 0, to: 50, kind: "cache" }] },
  { id: "parse", label: copy.parse, top: 72, blocks: [{ from: 50, to: 700, kind: "llm", label: "LLM" }] },
  {
    id: "w1",
    label: `${copy.wish} 1`,
    sub: "тихий",
    top: 156,
    blocks: [
      { from: 700, to: 1250, kind: "tool", label: "find_nearby" },
      { from: 1250, to: 1850, kind: "tool", label: "search_documents" },
      { from: 1850, to: 2300, kind: "tool", label: "match_records" },
    ],
  },
  {
    id: "w2",
    label: `${copy.wish} 2`,
    sub: "у моря",
    top: 224,
    blocks: [
      { from: 700, to: 1300, kind: "tool", label: "measure_geometry" },
      { from: 1300, to: 1750, kind: "tool", label: "calculate_sun" },
      { from: 1750, to: 1800, kind: "cache", label: "find_nearby" },
    ],
  },
  {
    id: "w3",
    label: `${copy.wish} 3`,
    sub: "с собакой",
    top: 292,
    blocks: [
      { from: 700, to: 1450, kind: "tool", label: "search_web" },
      { from: 1450, to: 2200, kind: "tool", label: "read_web_page" },
      { from: 2200, to: 2250, kind: "cache", label: "match_records" },
    ],
  },
  {
    id: "review",
    label: copy.review,
    top: 376,
    blocks: [
      { from: 2350, to: 2780, kind: "wave", label: "12" },
      { from: 2800, to: 3180, kind: "wave", label: "12" },
      { from: 3200, to: 3540, kind: "wave", label: "12" },
    ],
  },
  { id: "answer", label: copy.answer, top: 448, blocks: [{ from: 3560, to: 3790, kind: "answer" }] },
]

const CALLOUTS: readonly { readonly text: string; readonly at: number; readonly icon: LucideIcon }[] = [
  { text: copy.routeCache, at: 60, icon: Zap },
  { text: copy.parallel, at: 720, icon: Layers },
  { text: copy.llmCache, at: 1800, icon: Database },
  { text: copy.waves, at: 2380, icon: Waves },
]

const TICKS = [0, 1000, 2000, 3000]

const at = (ms: number) => START_S + ms * REAL
const seconds = (ms: number) => `${(ms / 1000).toFixed(2).replace(".", ",")} с`

const blockStyle = (block: Block) =>
  ({
    left: block.from * SCALE,
    width: Math.max(10, (block.to - block.from) * SCALE),
    "--delay": `${at(block.from)}s`,
    "--dur": `${Math.max(0.12, (block.to - block.from) * REAL)}s`,
    "--after": `${at(block.to)}s`,
  }) as CSSProperties

function Playhead() {
  const head = useRef<HTMLDivElement>(null)
  const time = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    let frame = 0
    let started = 0
    const run = (now: number) => {
      started ||= now
      const elapsed = (now - started) / 1000 - START_S
      const ms = Math.min(TOTAL_MS, Math.max(0, elapsed / REAL))
      if (head.current) head.current.style.translate = `${ms * SCALE}px 0`
      if (time.current) time.current.textContent = seconds(ms)
      if (ms < TOTAL_MS) frame = requestAnimationFrame(run)
    }
    frame = requestAnimationFrame(run)
    return () => cancelAnimationFrame(frame)
  }, [])
  return (
    <div ref={head} className={styles.playhead} aria-hidden="true">
      <span ref={time} className={styles.playTime}>
        {seconds(0)}
      </span>
    </div>
  )
}

function BlockView({ block }: { readonly block: Block }) {
  if (block.kind === "cache") {
    return (
      <div className={styles.cacheWrap} style={blockStyle(block)}>
        <span className={`${styles.block} ${styles.cache}`} />
        <span className={styles.cacheTag}>
          <Zap size={18} strokeWidth={2.4} />
          <span>{copy.cache}</span>
          {block.label ? <code>{block.label}</code> : null}
        </span>
      </div>
    )
  }
  return (
    <div className={`${styles.block} ${styles[block.kind]}`} style={blockStyle(block)}>
      {block.label ? <code>{block.label}</code> : null}
    </div>
  )
}

export function PipelineSlide() {
  return (
    <div className={`${parts.slide} ${styles.root}`}>
      <SlideTitle title={copy.title} accent={copy.accent} />
      <section className={styles.chart}>
        <div className={styles.group} aria-hidden="true" />
        {ROWS.map((row, i) => (
          <div
            key={row.id}
            className={styles.row}
            style={{ top: row.top, "--delay": `${0.3 + i * 0.06}s` } as CSSProperties}
          >
            <div className={styles.label}>
              <span>{row.label}</span>
              {row.sub ? <span className={styles.sub}>{row.sub}</span> : null}
            </div>
            <div className={styles.track}>
              {row.blocks.map((block) => (
                <BlockView key={`${block.from}-${block.kind}`} block={block} />
              ))}
            </div>
          </div>
        ))}
        <div className={styles.axis}>
          {TICKS.map((tick) => (
            <span key={tick} className={styles.tick} style={{ left: tick * SCALE }}>
              {tick / 1000} с
            </span>
          ))}
        </div>
        <div className={styles.lane}>
          {TICKS.map((tick) => (
            <span key={tick} className={styles.grid} style={{ left: tick * SCALE }} />
          ))}
          <Playhead />
        </div>
      </section>
      <aside className={styles.callouts}>
        {CALLOUTS.map(({ text, at: ms, icon: Icon }) => (
          <p key={text} className={styles.callout} style={{ "--delay": `${at(ms)}s` } as CSSProperties}>
            <span className={styles.calloutIcon}>
              <Icon size={24} strokeWidth={2.2} />
            </span>
            <span>{text}</span>
          </p>
        ))}
      </aside>
      <p className={styles.metric} style={{ "--delay": `${at(TOTAL_MS) + 0.2}s` } as CSSProperties}>
        <Timer size={34} strokeWidth={2.2} className={styles.metricIcon} />
        <span>{copy.median}</span>
      </p>
    </div>
  )
}

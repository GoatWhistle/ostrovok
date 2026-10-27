import type { CSSProperties } from "react"
import { type MessageKey, useFormatters, useTranslation } from "@/shared/i18n"
import { staggerStyle } from "@/shared/motion"
import { Chip } from "@/shared/ui"
import styles from "./agent-progress.module.css"
import type { ProgressView, WishState } from "./progress-view"

const WISH_LABEL: Readonly<Record<WishState, MessageKey>> = {
  queued: "explore:chat.progress.wish.queued",
  checking: "explore:chat.progress.wish.checking",
  verified: "explore:chat.progress.wish.verified",
  partial: "explore:chat.progress.wish.partial",
  missing: "explore:chat.progress.wish.missing",
  unknown: "explore:chat.progress.wish.unknown",
}

const DOUBTED: ReadonlySet<WishState> = new Set(["partial", "missing", "unknown"])

interface Fact {
  readonly id: string
  readonly label: string
}

export function understoodName(index: number): CSSProperties {
  return { viewTransitionName: `understood-${index}` }
}

function useFacts(view: ProgressView): Fact[] {
  const { t } = useTranslation()
  const format = useFormatters()
  const facts: Fact[] = []
  if (view.location) facts.push({ id: "location", label: view.location })
  if (view.checkIn) {
    const from = format.shortDate(view.checkIn)
    const label = view.checkOut
      ? t("explore:chat.progress.dates", { from, to: format.shortDate(view.checkOut) })
      : from
    facts.push({ id: "dates", label })
  }
  if (view.adults)
    facts.push({ id: "adults", label: t("explore:offers.adults", { count: view.adults }) })
  return facts
}

export function UnderstoodChips({ view }: { readonly view: ProgressView }) {
  const { t } = useTranslation()
  const facts = useFacts(view)
  return (
    <div className={styles.group}>
      <p className={styles.caption}>{t("explore:chat.understood")}</p>
      <div className={styles.chips}>
        {facts.map((fact, index) => (
          <span key={fact.id} className={styles.item} style={staggerStyle(index) as CSSProperties}>
            <Chip static label={fact.label} />
          </span>
        ))}
        {view.wishes.map((wish, index) => (
          <span
            key={wish.term}
            className={styles.item}
            data-state={wish.state}
            style={
              { ...staggerStyle(facts.length + index), ...understoodName(index) } as CSSProperties
            }
          >
            <Chip
              static
              label={wish.term}
              trailing={
                <span className={styles.verdict}>
                  {DOUBTED.has(wish.state) ? <span className={styles.mark} /> : null}
                  <span className="visually-hidden">{t(WISH_LABEL[wish.state])}</span>
                </span>
              }
            />
          </span>
        ))}
      </div>
    </div>
  )
}

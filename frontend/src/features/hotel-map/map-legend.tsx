import { useEffect, useId, useRef, useState } from "react"
import type { MessageKey } from "@/shared/i18n"
import { useTranslation } from "@/shared/i18n"
import { usePresence } from "@/shared/motion"
import { Banner, Button, Icon } from "@/shared/ui"
import styles from "./map-legend.module.css"

const ITEMS: readonly { readonly label: MessageKey; readonly swatch: string }[] = [
  { label: "explore:map.legendHotel", swatch: "hotel" },
  { label: "explore:map.legendSelected", swatch: "selected" },
  { label: "explore:map.legendFact", swatch: "fact" },
  { label: "explore:map.legendRoute", swatch: "route" },
  { label: "explore:map.legendRelief", swatch: "relief" },
]

const GESTURES: readonly { readonly input: MessageKey; readonly action: MessageKey }[] = [
  { input: "explore:map.gestureDrag", action: "explore:map.gestureDragAction" },
  { input: "explore:map.gestureRotate", action: "explore:map.gestureRotateAction" },
  { input: "explore:map.gestureWheel", action: "explore:map.gestureWheelAction" },
  { input: "explore:map.gestureTouch", action: "explore:map.gestureTouchAction" },
]

function MapLegend({
  id,
  open,
  notes,
}: {
  readonly id: string
  readonly open: boolean
  readonly notes: readonly MessageKey[]
}) {
  const { t } = useTranslation()
  const presence = usePresence(open)
  if (!presence.mounted) return null
  return (
    <section
      id={id}
      className={styles.legend}
      data-state={presence.state}
      aria-label={t("explore:map.layers")}
      onAnimationEnd={presence.onAnimationEnd}
    >
      {notes.length ? (
        <Banner tone="warning" title={t("explore:map.approximateTitle")} className={styles.notice}>
          <ul className={styles.notes}>
            {notes.map((note) => (
              <li key={note}>{t(note)}</li>
            ))}
          </ul>
        </Banner>
      ) : null}
      <p className={styles.title}>{t("explore:map.layers")}</p>
      <ul className={styles.items}>
        {ITEMS.map((item) => (
          <li key={item.swatch} className={styles.item}>
            <span className={styles.swatchCell} aria-hidden="true">
              <span className={styles.swatch} data-swatch={item.swatch}>
                {item.swatch === "hotel" || item.swatch === "selected" ? (
                  <Icon name="check" size="sm" />
                ) : null}
              </span>
            </span>
            <span>{t(item.label)}</span>
          </li>
        ))}
      </ul>
      <p className={styles.title}>{t("explore:map.controlsTitle")}</p>
      <dl className={styles.gestures}>
        {GESTURES.map((gesture) => (
          <div key={gesture.input} className={styles.gesture}>
            <dt className={styles.input}>{t(gesture.input)}</dt>
            <dd className={styles.action}>{t(gesture.action)}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function MapLegendToggle({ notes }: { readonly notes: readonly MessageKey[] }) {
  const { t } = useTranslation()
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", close)
    document.addEventListener("keydown", dismiss)
    return () => {
      document.removeEventListener("pointerdown", close)
      document.removeEventListener("keydown", dismiss)
    }
  }, [open])
  return (
    <div ref={root} className={styles.anchor}>
      <MapLegend id={id} open={open} notes={notes} />
      <Button
        variant="ghost"
        size="compact"
        iconOnly
        icon="layers"
        className={styles.toggle}
        title={t("explore:map.layers")}
        aria-expanded={open}
        aria-controls={id}
        data-notes={notes.length > 0 || undefined}
        onClick={() => setOpen((current) => !current)}
      >
        {t("explore:map.layers")}
      </Button>
    </div>
  )
}

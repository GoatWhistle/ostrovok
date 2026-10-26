import type { MessageKey } from "@/shared/i18n"
import { useTranslation } from "@/shared/i18n"
import { usePresence } from "@/shared/motion"
import { Icon } from "@/shared/ui"
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

export function MapLegend({
  open,
  notes,
}: {
  readonly open: boolean
  readonly notes: readonly MessageKey[]
}) {
  const { t } = useTranslation()
  const presence = usePresence(open)
  if (!presence.mounted) return null
  return (
    <section
      className={styles.legend}
      data-state={presence.state}
      aria-label={t("explore:map.layers")}
      onAnimationEnd={presence.onAnimationEnd}
    >
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
      {notes.length ? (
        <>
          <p className={styles.title}>{t("explore:map.approximateTitle")}</p>
          <ul className={styles.notes}>
            {notes.map((note) => (
              <li key={note} className={styles.note}>
                <Icon name="partial" size="sm" className={styles.noteIcon} />
                <span>{t(note)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
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

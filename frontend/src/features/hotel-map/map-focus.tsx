import type { ReactNode } from "react"
import type { FactBrief, MatchedProperty } from "@/shared/api/hotel-types"
import { matchedValue } from "@/shared/geo/facts/fact-label"
import { useLocale } from "@/shared/i18n"
import { characteristicIcon, Popover } from "@/shared/ui"
import styles from "./map-focus.module.css"

export interface MapFocusProps {
  readonly label: string | undefined
  readonly explanation: string | undefined
  readonly fact: FactBrief | undefined
  readonly property: MatchedProperty | undefined
  readonly route: boolean
  readonly children?: ReactNode
}

export function MapFocus({ label, explanation, fact, property, route, children }: MapFocusProps) {
  const { locale } = useLocale()
  if (!label) return null
  const selected = property?.fact ?? fact
  const summary = matchedValue(selected, locale)
  const icon = route
    ? "walk"
    : characteristicIcon(property?.characteristic_key ?? selected?.characteristic_key ?? "map")
  return (
    <div className={styles.focus}>
      <span role="status" className="visually-hidden">
        {label}
      </span>
      <Popover key={label} label={label} icon={icon} summary={summary} placement="bottom">
        <div className={styles.content}>
          <strong>{label}</strong>
          {explanation ? <span>{explanation}</span> : null}
          {children}
        </div>
      </Popover>
    </div>
  )
}

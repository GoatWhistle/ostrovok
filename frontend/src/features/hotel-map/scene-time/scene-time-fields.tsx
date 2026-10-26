import { useId } from "react"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Button } from "@/shared/ui"
import { dayLabel, shiftDate } from "./scene-time"
import styles from "./scene-time-panel.module.css"

interface StepperProps {
  readonly label: string
  readonly value: string
  readonly previous: string
  readonly next: string
  readonly canPrevious: boolean
  readonly canNext: boolean
  readonly onPrevious: () => void
  readonly onNext: () => void
}

function Stepper({
  label,
  value,
  previous,
  next,
  canPrevious,
  canNext,
  onPrevious,
  onNext,
}: StepperProps) {
  const id = useId()
  return (
    <div className={styles.field}>
      <span id={id} className="visually-hidden">
        {label}
      </span>
      <div className={styles.stepper}>
        <Button
          variant="ghost"
          size="compact"
          iconOnly
          icon="chevron-left"
          title={previous}
          disabled={!canPrevious}
          onClick={onPrevious}
        >
          {previous}
        </Button>
        <output className={styles.stepperValue} aria-labelledby={id} aria-live="polite">
          {value}
        </output>
        <Button
          variant="ghost"
          size="compact"
          iconOnly
          icon="chevron-right"
          title={next}
          disabled={!canNext}
          onClick={onNext}
        >
          {next}
        </Button>
      </div>
    </div>
  )
}

export function DateStepper({
  date,
  minDate,
  maxDate,
  onDate,
}: {
  readonly date: string
  readonly minDate: string
  readonly maxDate: string
  readonly onDate: (value: string) => void
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  return (
    <Stepper
      label={t("explore:weather.date")}
      value={dayLabel(date, locale)}
      previous={t("explore:weather.previousDay")}
      next={t("explore:weather.nextDay")}
      canPrevious={date > minDate}
      canNext={date < maxDate}
      onPrevious={() => onDate(shiftDate(date, -1))}
      onNext={() => onDate(shiftDate(date, 1))}
    />
  )
}

export function HourStepper({
  hour,
  onHour,
}: {
  readonly hour: number
  readonly onHour: (value: number) => void
}) {
  const { t } = useTranslation()
  return (
    <Stepper
      label={t("explore:weather.time")}
      value={t("explore:weather.clock", { hour: String(hour).padStart(2, "0") })}
      previous={t("explore:weather.previousHour")}
      next={t("explore:weather.nextHour")}
      canPrevious={hour > 0}
      canNext={hour < 23}
      onPrevious={() => onHour(hour - 1)}
      onNext={() => onHour(hour + 1)}
    />
  )
}

import { useLocale, useTranslation } from "@/shared/i18n"
import { Button, Icon, ScrollArea, TextField } from "@/shared/ui"
import { type StayContext, useHotelStay } from "./hotel-stay"
import styles from "./stay-fields.module.css"

const DEFAULT_ADULTS = 2

function localDate(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value || localDate(new Date())}T12:00:00`)
  date.setDate(date.getDate() + days)
  return localDate(date)
}

function validCheckout(checkIn: string, checkOut: string): string {
  if (checkIn && (checkOut <= checkIn || checkOut > addDays(checkIn, 30)))
    return addDays(checkIn, 1)
  return checkOut
}

function hasStay(checkIn: string, checkOut: string, adults: number): boolean {
  return Boolean(checkIn && checkOut && adults)
}

const PRESETS = [
  { key: "weekend", label: "explore:offers.presetWeekend", nights: 2 },
  { key: "week", label: "explore:offers.presetWeek", nights: 2 },
] as const

function nextFriday(from: Date): Date {
  const date = new Date(from)
  const ahead = (5 - date.getDay() + 7) % 7 || 7
  date.setDate(date.getDate() + ahead)
  return date
}

function presetRange(key: (typeof PRESETS)[number]["key"], nights: number): [string, string] {
  const start = key === "weekend" ? nextFriday(new Date()) : new Date()
  if (key === "week") start.setDate(start.getDate() + 7)
  const from = localDate(start)
  return [from, addDays(from, nights)]
}

export function StayFields({ control }: { readonly control?: StayContext }) {
  const { t } = useTranslation()
  const shared = useHotelStay()
  const { value, update } = control ?? shared
  const { checkIn, checkOut, adults } = value
  const { locale } = useLocale()
  const today = localDate(new Date())
  const setCheckIn = (value: string) => update({ checkIn: value })
  const setCheckOut = (value: string) => update({ checkOut: value })
  const setAdults = (value: number) => update({ adults: value })
  return (
    <div className={styles.section}>
      <div className={styles.fields}>
        <TextField
          type="date"
          lang={locale}
          label={t("explore:offers.checkIn")}
          min={today}
          max={addDays(today, 730)}
          value={checkIn}
          onChange={(event) => {
            const value = event.target.value
            setCheckIn(value)
            setCheckOut(validCheckout(value, checkOut))
          }}
        />
        <TextField
          type="date"
          lang={locale}
          label={t("explore:offers.checkOut")}
          min={addDays(checkIn, 1)}
          max={addDays(checkIn, 30)}
          value={checkOut}
          onChange={(event) => setCheckOut(event.target.value)}
        />
      </div>
      <div className={styles.guests}>
        <Icon name="guests" size="sm" className={styles.guestIcon} />
        <span className={styles.guestLabel}>
          {adults
            ? t("explore:offers.adults", { count: adults })
            : t("explore:offers.chooseAdults")}
        </span>
        <Button
          variant="secondary"
          size="compact"
          iconOnly
          icon="minus"
          title={t("explore:offers.less")}
          disabled={adults <= 1}
          onClick={() => setAdults(adults - 1)}
        >
          {t("explore:offers.less")}
        </Button>
        <Button
          variant="secondary"
          size="compact"
          iconOnly
          icon="plus"
          title={t("explore:offers.more")}
          disabled={adults >= 10}
          onClick={() => setAdults(adults + 1)}
        >
          {t("explore:offers.more")}
        </Button>
      </div>

      {!hasStay(checkIn, checkOut, adults) ? (
        <>
          <ScrollArea className={styles.presets}>
            {PRESETS.map((preset) => (
              <Button
                key={preset.key}
                variant="secondary"
                size="compact"
                icon="calendar"
                onClick={() => {
                  const [from, to] = presetRange(preset.key, preset.nights)
                  update({ checkIn: from, checkOut: to, adults: adults || DEFAULT_ADULTS })
                }}
              >
                {t(preset.label)}
              </Button>
            ))}
          </ScrollArea>
        </>
      ) : null}
    </div>
  )
}

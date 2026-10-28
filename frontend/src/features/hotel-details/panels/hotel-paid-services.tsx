import { RowButton } from "@/entities/evidence"
import type { FactBrief } from "@/shared/api/hotel-types"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Icon } from "@/shared/ui"
import styles from "./hotel-paid-services.module.css"
import type { PaidService } from "./paid-services"

export interface HotelPaidServicesProps {
  readonly services: readonly PaidService[]
  readonly onFact: (fact: FactBrief) => void
}

export function HotelPaidServices({ services, onFact }: HotelPaidServicesProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const currency = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    signDisplay: "always",
  })
  return (
    <ul className={styles.paidList}>
      {services.map(({ fact, amount }) => (
        <li key={fact.fact_id}>
          <RowButton
            leading={<Icon name="pets" size="sm" />}
            trailing={
              <span className={styles.price}>
                <strong>{currency.format(amount)}</strong>
                <span className={styles.period}>{t("explore:hotelCard.periodUnknown")}</span>
              </span>
            }
            onClick={() => onFact(fact)}
          >
            <span className={styles.service}>{t("explore:hotelCard.petsService")}</span>
          </RowButton>
        </li>
      ))}
    </ul>
  )
}

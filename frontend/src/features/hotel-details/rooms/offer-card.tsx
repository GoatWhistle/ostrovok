import type { components } from "@/shared/api/schema.gen"
import { type MessageKey, useLocale, useTranslation } from "@/shared/i18n"
import { Icon } from "@/shared/ui"
import styles from "./offer-card.module.css"

type Offer = NonNullable<components["schemas"]["HotelOffers"]["offers"]>[number]

const MEAL: Readonly<Record<string, MessageKey>> = {
  nomeal: "explore:offers.noMeal",
  breakfast: "explore:offers.breakfast",
  "half-board": "explore:offers.halfBoard",
  "full-board": "explore:offers.fullBoard",
  BI: "explore:offers.breakfast",
  HB: "explore:offers.halfBoard",
  FB: "explore:offers.fullBoard",
  AI: "explore:offers.allInclusive",
}

function mealKey(value: string): MessageKey {
  if (value.includes("all-inclusive")) return "explore:offers.allInclusive"
  return MEAL[value] ?? "explore:offers.unknownMeal"
}

export function OfferCard({ offer }: { readonly offer: Offer }) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const price = new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
    style: "currency",
    currency: offer.price_currency,
    maximumFractionDigits: 0,
  }).format(offer.price_amount)
  return (
    <li className={styles.offer}>
      <div className={styles.offerTop}>
        <span className={styles.room} lang="ru">
          {offer.room_name}
        </span>
        <span className={styles.price}>{price}</span>
      </div>
      <ul className={styles.meta}>
        <li className={styles.metaItem}>
          <Icon name="calendar" size="sm" />
          {t("explore:offers.stayTotal")}
        </li>
        {offer.available_rooms != null ? (
          <li className={styles.metaItem}>
            <Icon name="room" size="sm" />
            {t("explore:offers.availableRooms", { count: offer.available_rooms })}
          </li>
        ) : null}
        {offer.meal ? (
          <li className={styles.metaItem}>
            <Icon name="check" size="sm" />
            {t("explore:offers.meal", { value: t(mealKey(offer.meal)) })}
          </li>
        ) : null}
        {offer.amenities.includes("non-smoking") ? (
          <li className={styles.metaItem}>{t("explore:offers.nonSmoking")}</li>
        ) : null}
        {offer.free_cancellation_before ? (
          <li className={styles.metaItem}>
            {t("explore:rooms.freeCancellation", {
              date: new Intl.DateTimeFormat(locale, {
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(offer.free_cancellation_before)),
            })}
          </li>
        ) : null}
        {offer.bed_places ? (
          <li className={styles.metaItem}>
            <Icon name="room" size="sm" />
            {t("explore:offers.bedPlaces", { count: offer.bed_places.main })}
          </li>
        ) : null}
        {offer.bed_places && offer.bed_places.extra > 0 ? (
          <li className={styles.metaItem}>
            {t("explore:offers.extraBeds", { count: offer.bed_places.extra })}
          </li>
        ) : null}
        {offer.bed_places && offer.bed_places.child_cots > 0 ? (
          <li className={styles.metaItem}>
            {t("explore:offers.childCots", { count: offer.bed_places.child_cots })}
          </li>
        ) : null}
        {offer.floor_number != null ? (
          <li className={styles.metaItem}>
            <Icon name="height" size="sm" />
            {t("explore:offers.floor", { value: offer.floor_number })}
          </li>
        ) : null}
      </ul>
    </li>
  )
}

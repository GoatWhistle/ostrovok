import { HotelStars } from "@/entities/hotel"
import type { HotelSummary } from "@/shared/api/hotel-types"
import { useTranslation } from "@/shared/i18n"
import { Button, Icon } from "@/shared/ui"
import styles from "./hotel-hero.module.css"

export interface HotelHeroProps {
  readonly hotel: HotelSummary
  readonly titleId: string
  readonly onRooms: () => void
}

export function HotelHero({ hotel, titleId, onRooms }: HotelHeroProps) {
  const { t } = useTranslation()
  return (
    <header className={styles.hero}>
      <p id={titleId} className={styles.name} lang="ru">
        {hotel.name}
      </p>
      <HotelStars value={hotel.stars} />
      {hotel.address ? (
        <p className={styles.meta}>
          <Icon name="pin" size="sm" />
          <span lang="ru">{hotel.address}</span>
        </p>
      ) : null}
      <Button variant="secondary" icon="calendar" onClick={onRooms}>
        {t("explore:offers.viewRooms")}
      </Button>
    </header>
  )
}

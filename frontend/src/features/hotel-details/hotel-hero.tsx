import { HotelThumb, MatchScore, matchScore } from "@/entities/hotel"
import type { HotelSummary, MatchedProperty } from "@/shared/api/hotel-types"
import { sourceUrl } from "@/shared/api/source-url"
import { useTranslation } from "@/shared/i18n"
import { Icon, NoValue } from "@/shared/ui"
import styles from "./hotel-hero.module.css"

export interface HotelHeroProps {
  readonly hotel: HotelSummary
  readonly matched: readonly MatchedProperty[]
  readonly titleId: string
}

export function HotelHero({ hotel, matched, titleId }: HotelHeroProps) {
  const { t } = useTranslation()
  const photo = sourceUrl(hotel.thumbnail_url)
  return (
    <header className={styles.hero}>
      <div className={styles.identity}>
        <HotelThumb src={photo} className={styles.thumb} />
        <div className={styles.heading}>
          <div className={styles.top}>
            <p id={titleId} className={styles.name} lang="ru">
              {hotel.name}
            </p>
            <MatchScore score={matchScore({ matched: [...matched] })} className={styles.score} />
          </div>
          <p className={styles.meta}>
            <Icon name="pin" size="sm" />
            {hotel.address ? <span lang="ru">{hotel.address}</span> : <NoValue />}
          </p>
        </div>
      </div>
      <ul className={styles.stats}>
        {hotel.stars ? (
          <li>
            <Icon name="verified" size="sm" />
            {t("explore:details.summaryStars", { count: hotel.stars })}
          </li>
        ) : null}
        {hotel.levels ? (
          <li>
            <Icon name="height" size="sm" />
            {t("explore:details.levels", { count: hotel.levels })}
          </li>
        ) : null}
        {hotel.height_m ? (
          <li>
            <Icon name="building" size="sm" />
            {t("explore:details.height", { value: hotel.height_m })}
          </li>
        ) : null}
      </ul>
    </header>
  )
}

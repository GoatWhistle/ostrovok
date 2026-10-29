import { Ruler, Star, VolumeX, Waves, type LucideIcon } from "lucide-react"
import { useEffect, useState } from "react"
import hotel1 from "../../assets/hotel/hotel-1.jpg"
import hotel2 from "../../assets/hotel/hotel-2.jpg"
import hotel3 from "../../assets/hotel/hotel-3.jpg"
import hotel4 from "../../assets/hotel/hotel-4.jpg"
import hotel5 from "../../assets/hotel/hotel-5.jpg"
import roomDeluxeSea from "../../assets/hotel/room-deluxe-sea.jpg"
import roomPremiumAttic from "../../assets/hotel/room-premium-attic.jpg"
import roomStandard from "../../assets/hotel/room-standard.webp"
import { COPY } from "../../deck/copy"
import parts from "../../deck/deck-parts.module.css"
import { SlideTitle } from "../../deck/slide-title"
import styles from "./card-slide.module.css"

const PHOTOS = [hotel1, hotel2, hotel3, hotel4, hotel5] as const
const PHOTO_TOTAL = 24
const PHOTO_MS = 2500
const STARS = 4
const REVIEWS = 166
const RATING = 9.2

const NUMBER = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 })
const SCORE = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 })

const RATINGS: readonly { readonly key: keyof typeof COPY.card.ratings; readonly value: number }[] = [
  { key: "location", value: 9.5 },
  { key: "cleanness", value: 9.0 },
  { key: "services", value: 9.3 },
  { key: "meal", value: 8.9 },
]

const ROOMS: readonly { readonly name: string; readonly area: number; readonly photo: string }[] = [
  { name: "Двухместный номер Стандартный с балконом", area: 23, photo: roomStandard },
  { name: "Двухместный номер Делюкс с балконом и с видом на море", area: 44, photo: roomDeluxeSea },
  { name: "Двухместный люкс Премиум Мансарда с видом на море", area: 51, photo: roomPremiumAttic },
]

const FACTS: readonly { readonly label: string; readonly icon: LucideIcon }[] = [
  { label: "1,2 мин до моря", icon: Waves },
  { label: "Тихо", icon: VolumeX },
  { label: "28,8 м", icon: Ruler },
]

function fill(template: string, value: number) {
  return template.replace(/\{\{\w+, number\}\}/, NUMBER.format(value))
}

export function CardSlide() {
  const [photo, setPhoto] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => setPhoto((value) => (value + 1) % PHOTOS.length), PHOTO_MS)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <section className={parts.slide}>
      <div className={parts.scrim} />
      <SlideTitle title={COPY.card.title} accent={COPY.card.accent} />
      <article className={`${parts.plate} ${styles.card}`}>
        <div className={styles.gallery}>
          {PHOTOS.map((src, index) => (
            <img
              key={src}
              src={src}
              alt=""
              className={styles.photo}
              data-active={index === photo || undefined}
              style={{ animationDelay: `${-index * 2.3}s` }}
            />
          ))}
          <span className={styles.counter}>
            {photo + 1}/{PHOTO_TOTAL}
          </span>
        </div>
        <div className={styles.body}>
          <header className={styles.head}>
            <div className={styles.nameBlock}>
              <h3 className={styles.name}>El Paraiso</h3>
              <span className={styles.stars} aria-label={`${STARS}`}>
                {Array.from({ length: STARS }, (_, index) => (
                  <Star key={index} size={18} strokeWidth={0} fill="currentColor" />
                ))}
              </span>
            </div>
            <div className={styles.score}>
              <span className={styles.badge}>{SCORE.format(RATING)}</span>
              <span className={styles.reviews}>{fill(COPY.card.reviews_many, REVIEWS)}</span>
            </div>
          </header>
          <ul className={styles.ratings}>
            {RATINGS.map((rating, index) => (
              <li key={rating.key} className={styles.rating}>
                <span className={styles.ratingLabel}>{COPY.card.ratings[rating.key]}</span>
                <span className={styles.ratingValue}>{SCORE.format(rating.value)}</span>
                <span className={styles.track}>
                  <span
                    className={styles.bar}
                    style={{ width: `${rating.value * 10}%`, animationDelay: `${0.7 + index * 0.12}s` }}
                  />
                </span>
              </li>
            ))}
          </ul>
          <section className={styles.group}>
            <h4 className={styles.section}>{COPY.card.rooms}</h4>
            <ul className={styles.rooms}>
              {ROOMS.map((room, index) => (
                <li key={room.name} className={styles.room} style={{ animationDelay: `${1.1 + index * 0.16}s` }}>
                  <img src={room.photo} alt="" className={styles.thumb} />
                  <span className={styles.roomName}>{room.name}</span>
                  <span className={styles.area}>{fill(COPY.card.area, room.area)}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className={styles.group}>
            <h4 className={styles.section}>{COPY.card.facts}</h4>
            <ul className={styles.chips}>
              {FACTS.map((fact, index) => {
                const Icon = fact.icon
                return (
                  <li key={fact.label} className={styles.chip} style={{ animationDelay: `${1.7 + index * 0.12}s` }}>
                    <Icon size={18} strokeWidth={2.4} />
                    {fact.label}
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      </article>
    </section>
  )
}

import type { RefObject } from "react"
import { useTranslation } from "@/shared/i18n"
import { Card, Icon } from "@/shared/ui"
import type { StoryFrame } from "../playback/story-frame"
import type { CoverTiming } from "../playback/timing"
import styles from "./route-story.module.css"
import { TypedRequest } from "./typed-request"

interface RouteStoryProps {
  readonly frame: StoryFrame
  readonly time: number
  readonly timing: CoverTiming
  readonly hotel: RefObject<HTMLDivElement | null>
  readonly goal: RefObject<HTMLDivElement | null>
}

export function RouteStory({ frame, time, timing, hotel, goal }: RouteStoryProps) {
  const { t } = useTranslation()
  return (
    <>
      <div
        className={styles.request}
        style={{ opacity: frame.request }}
        aria-hidden={frame.request === 0}
      >
        <TypedRequest
          text={t("explore:cover.beachWish")}
          label={t("explore:cover.example")}
          time={time}
          duration={timing.firstType}
          timing={timing}
        />
      </div>
      <div
        className={styles.request}
        style={{ opacity: frame.wish }}
        aria-hidden={frame.wish === 0}
      >
        <TypedRequest
          text={t("explore:cover.sunsetWish")}
          label={t("explore:cover.nextExample")}
          time={frame.local}
          duration={timing.secondType}
          timing={timing}
        />
      </div>
      <div
        ref={hotel}
        className={styles.marker}
        style={{ opacity: frame.selected }}
        aria-hidden={frame.selected === 0}
      >
        <Icon name="building" size="sm" />
        {t("explore:cover.hotel")}
      </div>
      <div
        ref={goal}
        className={styles.marker}
        style={{ opacity: frame.goal }}
        aria-hidden={frame.goal === 0}
      >
        <Icon name="walk" size="sm" />
        {t("explore:cover.beachPath")}
      </div>
      <Card
        as="div"
        className={styles.proof}
        style={{ opacity: frame.proof }}
        aria-hidden={frame.proof === 0}
      >
        <span className={styles.eyebrow}>{t("explore:cover.why")}</span>
        <strong>{t("explore:cover.routeTitle", { minutes: 4, meters: 240 })}</strong>
        <p>{t("explore:cover.routeNote")}</p>
      </Card>
    </>
  )
}

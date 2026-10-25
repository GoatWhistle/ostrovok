import { SceneReel } from "@/features/scene-reel"
import { ChatStart } from "@/features/search-chat"
import styles from "./landing.module.css"
import { LandingSettings } from "./landing-settings"

export interface LandingProps {
  readonly pending: boolean
  readonly onSend: (message: string) => void
}

export function Landing({ pending, onSend }: LandingProps) {
  return (
    <div className={styles.landing} data-chrome="bare">
      <div className={styles.corner}>
        <LandingSettings />
      </div>
      <div className={styles.stage}>
        <div className={styles.copy}>
          <ChatStart pending={pending} onSend={onSend} />
        </div>
        <div className={styles.visual}>
          <SceneReel />
        </div>
      </div>
    </div>
  )
}

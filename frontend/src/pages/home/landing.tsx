import { SceneReel } from "@/features/scene-reel"
import { ChatStart } from "@/features/search-chat"
import styles from "./landing.module.css"
import { LandingSettings } from "./landing-settings"

export interface LandingProps {
  readonly pending: boolean
  readonly recent: readonly { readonly id: string; readonly title: string }[]
  readonly onSend: (message: string) => void
  readonly onOpen: (id: string) => void
  readonly onHistory: () => void
}

export function Landing({ pending, recent, onSend, onOpen, onHistory }: LandingProps) {
  return (
    <div className={styles.landing} data-chrome="bare">
      <div className={styles.corner}>
        <LandingSettings />
      </div>
      <div className={styles.stage}>
        <div className={styles.copy}>
          <ChatStart
            pending={pending}
            recent={recent}
            onSend={onSend}
            onOpen={onOpen}
            onHistory={onHistory}
          />
        </div>
        <div className={styles.visual}>
          <SceneReel />
        </div>
      </div>
    </div>
  )
}

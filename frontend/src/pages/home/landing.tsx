import { useState } from "react"
import { SceneReel } from "@/features/scene-reel"
import { ChatStart, type ChatStartProps } from "@/features/search-chat"
import styles from "./landing.module.css"
import { SiteSettings } from "./site-settings"

export interface LandingProps {
  readonly draftKey: string
  readonly pending: boolean
  readonly recent: ChatStartProps["recent"]
  readonly onSend: (message: string) => void
  readonly onOpen: (id: string) => void
  readonly onHistory: () => void
}

export function Landing({ pending, recent, onSend, onOpen, onHistory, draftKey }: LandingProps) {
  const [interruption, interrupt] = useState(0)
  return (
    <div className={styles.landing} data-chrome="bare">
      <div className={styles.corner}>
        <SiteSettings surface="glass" />
      </div>
      <div className={styles.stage}>
        <div className={styles.copy}>
          <ChatStart
            pending={pending}
            draftKey={draftKey}
            recent={recent}
            onInteraction={() => interrupt((value) => value + 1)}
            onSend={(message) => {
              interrupt((value) => value + 1)
              onSend(message)
            }}
            onOpen={onOpen}
            onHistory={onHistory}
          />
        </div>
        <div className={styles.visual}>
          <SceneReel interruption={interruption} />
        </div>
      </div>
    </div>
  )
}

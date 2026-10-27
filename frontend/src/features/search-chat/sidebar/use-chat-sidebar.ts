import { useState } from "react"
import { useMediaQuery } from "@/shared/hooks"
import { withViewTransition } from "@/shared/motion"

const STORAGE_KEY = "factmap-chat-sidebar"
const ROOMY = "(min-width: 75rem)"
const WIDE = "(min-width: 64rem)"

function readStored(): boolean | undefined {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    if (value === "collapsed") return true
    return value === "expanded" ? false : undefined
  } catch {
    return undefined
  }
}

function writeStored(collapsed: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "collapsed" : "expanded")
  } catch {
    return
  }
}

export interface ChatSidebarState {
  readonly inline: boolean
  readonly collapsed: boolean
  readonly drawerOpen: boolean
  readonly openChats: (() => void) | undefined
  readonly reveal: () => void
  readonly toggle: () => void
  readonly closeDrawer: () => void
}

export function useChatSidebar(instant: boolean, inline: boolean): ChatSidebarState {
  const roomy = useMediaQuery(ROOMY)
  const wide = useMediaQuery(WIDE)
  const [stored, setStored] = useState(readStored)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const collapsed = stored ?? !roomy
  const persist = (next: boolean) => {
    const apply = () => {
      setStored(next)
      writeStored(next)
    }
    if (instant || next === collapsed) apply()
    else void withViewTransition("layout", apply)
  }
  return {
    inline: wide && inline,
    collapsed,
    drawerOpen,
    openChats: wide && inline ? undefined : () => setDrawerOpen(true),
    reveal: () => (wide ? persist(false) : setDrawerOpen(true)),
    toggle: () => persist(!collapsed),
    closeDrawer: () => setDrawerOpen(false),
  }
}

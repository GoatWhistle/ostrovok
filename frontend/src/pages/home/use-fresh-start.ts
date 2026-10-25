import { useEffect, useRef } from "react"
import { useLocation, useNavigate } from "react-router"

export function useFreshStart(reset: () => void) {
  const location = useLocation()
  const navigate = useNavigate()
  const latest = useRef(reset)
  latest.current = reset
  const fresh = (location.state as { fresh?: unknown } | null)?.fresh === true
  useEffect(() => {
    if (!fresh) return
    latest.current()
    void navigate(location.pathname, { replace: true, state: null })
  }, [fresh, navigate, location.pathname])
}

type Draft = { readonly value: string; readonly durable: boolean; readonly dirty: boolean }
const drafts = new Map<string, Draft>()
const listeners = new Set<() => void>()
const prefix = "hotel-draft:v1:"

export function readSessionDraft(key: string, initial = ""): Draft {
  const found = drafts.get(key)
  if (found && (found.dirty || found.value === initial)) return found
  let draft: Draft
  try {
    const stored = sessionStorage.getItem(prefix + key)
    draft = { value: stored ?? initial, durable: true, dirty: stored !== null }
  } catch {
    draft = { value: initial, durable: false, dirty: false }
  }
  drafts.set(key, draft)
  return draft
}

export function writeSessionDraft(key: string, value: string) {
  let durable = true
  try {
    sessionStorage.setItem(prefix + key, value)
  } catch {
    durable = false
  }
  drafts.set(key, { value, durable, dirty: true })
  for (const listener of listeners) listener()
}

export function clearSessionDraft(key: string, expected: string) {
  if (drafts.get(key)?.value !== expected) return
  try {
    sessionStorage.removeItem(prefix + key)
  } catch {
    drafts.set(key, { value: "", durable: false, dirty: false })
  }
  drafts.delete(key)
  for (const listener of listeners) listener()
}

export function subscribeSessionDraft(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

import type { ChatProgress } from "./chat-stream"

import type { SearchPreview } from "./search-preview"

export interface SearchJourney {
  readonly finalists?: readonly SearchPreview[]
  readonly previews?: readonly SearchPreview[]
  readonly winner?: SearchPreview | undefined
  readonly status: string
  readonly location: string | null | undefined
  readonly bounds: readonly number[] | undefined
  readonly candidates: NonNullable<ChatProgress["hotels"]>
  readonly sending: boolean
  readonly request: number
}

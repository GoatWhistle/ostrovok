import { ApiError, codeOf, NETWORK_UNAVAILABLE, UNEXPECTED } from "./client"
import type { components } from "./schema.gen"

type Conversation = components["schemas"]["Conversation"]
type ChatRequest = components["schemas"]["ChatRequest"]

export interface ChatProgress {
  readonly stage: string
  readonly term?: string
  readonly found?: number
  readonly wishes?: number
}

interface Frame {
  readonly event: string
  readonly data: unknown
}

interface Received {
  answer: Conversation | null
  failure: ApiError | null
}

const ENDPOINT = "/api/v1/chat/messages/stream"

function frameOf(block: string): Frame | null {
  let event = ""
  let data = ""
  for (const line of block.split("\n")) {
    if (line.startsWith("event: ")) event = line.slice(7)
    if (line.startsWith("data: ")) data = line.slice(6)
  }
  if (event === "" || data === "") return null
  try {
    return { event, data: JSON.parse(data) as unknown }
  } catch {
    return null
  }
}

function accept(
  frame: Frame,
  received: Received,
  onProgress: (progress: ChatProgress) => void,
): void {
  if (frame.event === "progress") {
    onProgress(frame.data as ChatProgress)
    return
  }
  if (frame.event === "result") {
    received.answer = frame.data as Conversation
    return
  }
  if (frame.event === "error") received.failure = new ApiError(500, codeOf(frame.data))
}

async function consume(
  body: ReadableStream<Uint8Array>,
  received: Received,
  onProgress: (progress: ChatProgress) => void,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let split = buffer.indexOf("\n\n")
    while (split !== -1) {
      const frame = frameOf(buffer.slice(0, split))
      buffer = buffer.slice(split + 2)
      if (frame !== null) accept(frame, received, onProgress)
      split = buffer.indexOf("\n\n")
    }
  }
}

export async function streamChatMessage(
  body: ChatRequest,
  onProgress: (progress: ChatProgress) => void,
  signal?: AbortSignal,
): Promise<Conversation> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(body),
    credentials: "same-origin",
    ...(signal === undefined ? {} : { signal }),
  })
  if (!response.ok || response.body === null) {
    const detail: unknown = await response.json().catch(() => null)
    throw new ApiError(response.status, detail === null ? UNEXPECTED : codeOf(detail))
  }
  const received: Received = { answer: null, failure: null }
  await consume(response.body, received, onProgress)
  if (received.failure !== null) throw received.failure
  if (received.answer === null) throw new ApiError(0, NETWORK_UNAVAILABLE)
  return received.answer
}

import { vi } from "vitest"
import { api } from "@/shared/api"

type Status = "open" | "skipped" | "answered"

export interface ServerQuestion {
  id: string
  characteristic_key: string
  status: Status
  answer_text?: string | null
  answered_at?: string | null
  answer_fact_ids?: string[]
}

export interface AnswerReply {
  readonly extracted?: number
  readonly followUp?: boolean
  readonly conflict?: boolean
  readonly fail?: boolean
}

function fact(id: string, key: string, status = "confirmed_by_hotelier") {
  return {
    fact_id: id,
    characteristic_key: key,
    value: true,
    label: "value",
    confidence: 1,
    source_type: "hotelier",
    status,
    provenance: { source_type: "hotelier", confidence: 1, computed_at: "2026-10-27T09:00:00Z" },
  }
}

function ok(data: unknown) {
  return Promise.resolve({ data, response: new Response("{}") })
}

export function hotelierServer(questions: ServerQuestion[], reply: AnswerReply = { extracted: 1 }) {
  const calls = { answers: [] as string[], statuses: [] as Status[] }
  const list = () => ({
    items: questions.map((item, index) => ({
      hotel_id: "h1",
      text: `Question ${index + 1}`,
      reason: "missing",
      created_at: `2026-10-2${index}T00:00:00Z`,
      ...item,
    })),
  })
  vi.spyOn(api, "GET").mockImplementation(((
    path: string,
    options: { params?: { path?: Record<string, string> } },
  ) => {
    if (path === "/hotelier/{hotel_id}/questions") return ok(list())
    if (path === "/hotels/{hotel_id}/facts/{fact_id}") {
      const id = options.params?.path?.fact_id ?? ""
      return ok({ ...fact(id, "double_room"), history: [] })
    }
    if (path === "/hotels/{hotel_id}") return ok({ hotel: { id: "h1" }, facts: [] })
    return Promise.reject(new Error(path))
  }) as never)
  vi.spyOn(api, "POST").mockImplementation(((
    _path: string,
    options: { params: { path: { question_id: string } }; body: { text: string } },
  ) => {
    const question = questions.find((item) => item.id === options.params.path.question_id)
    calls.answers.push(options.body.text)
    if (!question || reply.fail) return Promise.reject(new Error("offline"))
    if (reply.followUp)
      return ok({
        question_id: question.id,
        extracted: [],
        conflicts: [],
        follow_up: { ...list().items[0], id: question.id, text: "More details?" },
      })
    const ids = Array.from(
      { length: reply.extracted ?? 1 },
      (_, index) => `f_${question.id}_${index}`,
    )
    Object.assign(question, {
      status: "answered",
      answer_text: options.body.text,
      answered_at: "2026-10-27T09:00:00Z",
      answer_fact_ids: ids,
    })
    return ok({
      question_id: question.id,
      extracted: ids.map((id) => fact(id, question.characteristic_key)),
      conflicts: reply.conflict ? [{ id: "c1", fact_ids: ids, resolution: "pending" }] : [],
    })
  }) as never)
  vi.spyOn(api, "PATCH").mockImplementation(((
    _path: string,
    options: { params: { path: { question_id: string } }; body: { status: Status } },
  ) => {
    const question = questions.find((item) => item.id === options.params.path.question_id)
    calls.statuses.push(options.body.status)
    if (!question) return Promise.reject(new Error("missing"))
    question.status = options.body.status
    return ok({ ...list().items.find((item) => item.id === question.id) })
  }) as never)
  return calls
}

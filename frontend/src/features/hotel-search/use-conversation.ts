import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useRef, useState } from "react"
import { api, unwrap, useRecordMutation } from "@/shared/api"
import type { components } from "@/shared/api/schema.gen"
import { useLocale } from "@/shared/i18n"
import {
  forgetSaved,
  readConversationHistory,
  renameSaved,
  type SavedConversation,
  saveActiveConversation,
  saveConversationHistory,
  syncConversation,
} from "./conversation-history"

export type Conversation = components["schemas"]["Conversation"]

export interface ConversationControl {
  readonly id: string | null
  readonly scopeKey: string
  readonly begin: () => void
  readonly receive: (id: string) => void
  readonly open: (id: string) => void
  readonly reset: () => void
}

interface SendInput {
  readonly message: string
  readonly id: string | null
  readonly scope: string
  readonly generation: number
  readonly hotel: string | undefined
  readonly locale: "ru" | "en"
}

function serverEntry(data: Conversation) {
  return {
    id: data.id,
    title: data.title,
    updatedAt: data.updated_at,
    firstMessage: data.messages.find((item) => item.role === "user")?.content ?? "",
  }
}

async function sendRequest(input: SendInput) {
  const data = await unwrap(
    api.POST("/chat/messages", {
      body: {
        conversation_id: input.id,
        message: input.message,
        region_id: "russia",
        locale: input.locale,
        selected_hotel_id: input.hotel ?? null,
      },
    }),
  )
  if (input.id && data.id !== input.id) throw new Error("Conversation response mismatch")
  return data
}

export function useConversation(
  selectedHotel: string | undefined,
  onAnswer: (data: Conversation) => void,
  control: ConversationControl,
) {
  const { locale } = useLocale()
  const cache = useQueryClient()
  const [history, setHistory] = useState(readConversationHistory)
  const active = useRef({ scope: control.scopeKey, generation: 0 })
  if (active.current.scope !== control.scopeKey) {
    active.current = { scope: control.scopeKey, generation: active.current.generation + 1 }
  }
  const updateHistory = useCallback(
    (change: (previous: SavedConversation[]) => SavedConversation[]) =>
      setHistory((previous) => {
        const next = change(previous)
        saveConversationHistory(next)
        return next
      }),
    [],
  )
  const conversation = useQuery({
    queryKey: ["conversation", control.id],
    enabled: control.id !== null,
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/chat/conversations/{conversation_id}", {
          signal,
          params: { path: { conversation_id: control.id ?? "" } },
        }),
      ),
    retry: false,
  })
  useEffect(() => {
    const data = conversation.data
    if (data?.messages.some((item) => item.role === "user")) {
      updateHistory((previous) => syncConversation(previous, serverEntry(data)))
    }
  }, [conversation.data, updateHistory])
  const sendMessage = useRecordMutation(["chat-send", control.scopeKey], {
    mutationFn: sendRequest,
    onSuccess: (data, input) => {
      cache.setQueryData(["conversation", data.id], data)
      updateHistory((previous) => syncConversation(previous, serverEntry(data)))
      if (input.scope !== active.current.scope || input.generation !== active.current.generation)
        return
      saveActiveConversation(data.id)
      control.receive(data.id)
      onAnswer(data)
    },
  })
  const renameMutation = useMutation({
    mutationFn: ({ id, title }: { readonly id: string; readonly title: string }) =>
      unwrap(
        api.PATCH("/chat/conversations/{conversation_id}", {
          params: { path: { conversation_id: id } },
          body: { title },
        }),
      ),
    onSuccess: (data: Conversation) => {
      cache.setQueryData(["conversation", data.id], data)
      updateHistory((previous) => renameSaved(previous, data.id, data.title ?? ""))
    },
  })
  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error, response } = await api.DELETE("/chat/conversations/{conversation_id}", {
        params: { path: { conversation_id: id } },
      })
      if (error && response.status !== 404) throw error
      return id
    },
    onSuccess: (id: string) => {
      cache.removeQueries({ queryKey: ["conversation", id] })
      updateHistory((previous) => forgetSaved(previous, id))
      if (id === active.current.scope) reset()
    },
  })
  function reset() {
    active.current.generation += 1
    saveActiveConversation(null)
    control.reset()
  }
  function send(message: string) {
    if (!message.trim() || sendMessage.isPending) return
    control.begin()
    sendMessage.mutate({
      message,
      id: control.id,
      scope: control.scopeKey,
      generation: active.current.generation,
      hotel: selectedHotel,
      locale,
    })
  }
  const outgoing =
    sendMessage.isPending || sendMessage.isError ? sendMessage.variables?.message : undefined
  return {
    data: conversation.data,
    conversationId: control.id,
    history,
    outgoing,
    send,
    retry: () => (outgoing ? send(outgoing) : void conversation.refetch()),
    reset,
    open: (id: string) => {
      active.current.generation += 1
      saveActiveConversation(id)
      control.open(id)
    },
    rename: (id: string, title: string) => renameMutation.mutateAsync({ id, title }),
    remove: (id: string) => removeMutation.mutateAsync(id),
    loading: conversation.isPending && control.id !== null,
    sending: sendMessage.isPending,
    failed: sendMessage.isError || (conversation.isError && !conversation.data),
  }
}

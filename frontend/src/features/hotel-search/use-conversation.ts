import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useState } from "react"
import { api, isApiError, unwrap } from "@/shared/api"
import type { components } from "@/shared/api/schema.gen"
import { useLocale } from "@/shared/i18n"
import {
  forgetSaved,
  readActiveConversation,
  readConversationHistory,
  renameSaved,
  type SavedConversation,
  saveActiveConversation,
  saveConversationHistory,
  syncConversation,
} from "./conversation-history"

export type Conversation = components["schemas"]["Conversation"]

function serverEntry(data: Conversation) {
  return {
    id: data.id,
    title: data.title,
    updatedAt: data.updated_at,
    firstMessage: data.messages.find((item) => item.role === "user")?.content ?? "",
  }
}

export function useConversation(
  selectedHotel: string | undefined,
  onAnswer: (data: Conversation) => void,
) {
  const { locale } = useLocale()
  const cache = useQueryClient()
  const [conversationId, setConversationId] = useState<string | null>(readActiveConversation)
  const [history, setHistory] = useState(readConversationHistory)
  const [outgoing, setOutgoing] = useState<string>()
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
    queryKey: ["conversation", conversationId],
    enabled: conversationId !== null,
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/chat/conversations/{conversation_id}", {
          signal,
          params: { path: { conversation_id: conversationId ?? "" } },
        }),
      ),
    retry: false,
  })
  useEffect(() => {
    if (!isApiError(conversation.error, "not_found")) return
    saveActiveConversation(null)
    setConversationId(null)
    if (conversationId) updateHistory((previous) => forgetSaved(previous, conversationId))
  }, [conversation.error, conversationId, updateHistory])
  useEffect(() => {
    const data = conversation.data
    if (!data) return
    if (!data.messages.some((item) => item.role === "user")) return
    updateHistory((previous) => syncConversation(previous, serverEntry(data)))
  }, [conversation.data, updateHistory])
  const sendMessage = useMutation({
    mutationFn: (message: string) =>
      unwrap(
        api.POST("/chat/messages", {
          body: {
            conversation_id: conversationId,
            message,
            region_id: "russia",
            locale,
            selected_hotel_id: selectedHotel ?? null,
          },
        }),
      ),
    onSuccess: (data: Conversation) => {
      saveActiveConversation(data.id)
      updateHistory((previous) => syncConversation(previous, serverEntry(data)))
      cache.setQueryData(["conversation", data.id], data)
      setConversationId(data.id)
      setOutgoing(undefined)
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
      if (id === conversationId) {
        saveActiveConversation(null)
        setConversationId(null)
        setOutgoing(undefined)
      }
    },
  })
  function send(message: string) {
    setOutgoing(message)
    sendMessage.mutate(message)
  }
  return {
    data: conversation.data,
    conversationId,
    history,
    outgoing,
    send,
    retry: () => (outgoing ? sendMessage.mutate(outgoing) : void conversation.refetch()),
    reset: () => {
      if (sendMessage.isPending) return
      saveActiveConversation(null)
      setConversationId(null)
      setOutgoing(undefined)
      sendMessage.reset()
    },
    open: (id: string) => {
      if (sendMessage.isPending || !history.some((item) => item.id === id)) return
      saveActiveConversation(id)
      setConversationId(id)
      setOutgoing(undefined)
      sendMessage.reset()
    },
    rename: (id: string, title: string) => renameMutation.mutateAsync({ id, title }),
    remove: (id: string) => removeMutation.mutateAsync(id),
    loading: conversation.isPending && conversationId !== null,
    sending: sendMessage.isPending,
    failed: sendMessage.isError || (conversation.isError && !conversation.data),
  }
}

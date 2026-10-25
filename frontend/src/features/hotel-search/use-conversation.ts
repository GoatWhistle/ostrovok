import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { api, isApiError, unwrap } from "@/shared/api"
import type { components } from "@/shared/api/schema.gen"
import { useLocale } from "@/shared/i18n"
import {
  readActiveConversation,
  readConversationHistory,
  rememberConversation,
  saveActiveConversation,
  saveConversationHistory,
} from "./conversation-history"

export type Conversation = components["schemas"]["Conversation"]

export function useConversation(
  selectedHotel: string | undefined,
  onAnswer: (data: Conversation) => void,
) {
  const { locale } = useLocale()
  const cache = useQueryClient()
  const [conversationId, setConversationId] = useState<string | null>(readActiveConversation)
  const [history, setHistory] = useState(readConversationHistory)
  const [outgoing, setOutgoing] = useState<string>()
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
    if (conversationId) {
      setHistory((previous) => {
        const next = previous.filter((item) => item.id !== conversationId)
        saveConversationHistory(next)
        return next
      })
    }
  }, [conversation.error, conversationId])
  useEffect(() => {
    const data = conversation.data
    if (!data) return
    const firstMessage = data.messages.find((item) => item.role === "user")?.content
    if (!firstMessage) return
    setHistory((previous) => {
      const existing = previous.find((item) => item.id === data.id)
      if (existing?.title) return previous
      const next = rememberConversation(previous, data.id, firstMessage)
      saveConversationHistory(next)
      return next
    })
  }, [conversation.data])
  const sendMessage = useMutation({
    mutationFn: (message: string) =>
      unwrap(
        api.POST("/chat/messages", {
          body: {
            conversation_id: conversationId,
            message,
            region_id: "sochi",
            locale,
            selected_hotel_id: selectedHotel ?? null,
          },
        }),
      ),
    onSuccess: (data: Conversation) => {
      saveActiveConversation(data.id)
      const firstMessage = data.messages.find((item) => item.role === "user")?.content ?? ""
      setHistory((previous) => {
        const next = rememberConversation(previous, data.id, firstMessage)
        saveConversationHistory(next)
        return next
      })
      cache.setQueryData(["conversation", data.id], data)
      setConversationId(data.id)
      setOutgoing(undefined)
      onAnswer(data)
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
    loading: conversation.isPending && conversationId !== null,
    sending: sendMessage.isPending,
    failed: sendMessage.isError || (conversation.isError && !conversation.data),
  }
}

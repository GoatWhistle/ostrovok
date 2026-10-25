import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { api, isApiError, unwrap } from "@/shared/api"
import type { components } from "@/shared/api/schema.gen"
import { useLocale } from "@/shared/i18n"

export type Conversation = components["schemas"]["Conversation"]

const STORAGE_KEY = "hotel-agent-conversation"

function stored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function remember(id: string | null) {
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id)
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    return
  }
}

export function useConversation(
  selectedHotel: string | undefined,
  onAnswer: (data: Conversation) => void,
) {
  const { locale } = useLocale()
  const cache = useQueryClient()
  const [conversationId, setConversationId] = useState<string | null>(stored)
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
    remember(null)
    setConversationId(null)
  }, [conversation.error])
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
      remember(data.id)
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
    outgoing,
    send,
    retry: () => (outgoing ? sendMessage.mutate(outgoing) : void conversation.refetch()),
    reset: () => {
      remember(null)
      setConversationId(null)
      setOutgoing(undefined)
      sendMessage.reset()
    },
    loading: conversation.isPending && conversationId !== null,
    sending: sendMessage.isPending,
    failed: sendMessage.isError || (conversation.isError && !conversation.data),
  }
}

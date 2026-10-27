import {
  type MutationKey,
  type MutationState,
  type UseMutateFunction,
  type UseMutationOptions,
  useIsMutating,
  useMutation,
  useMutationState,
  useQueryClient,
} from "@tanstack/react-query"

export function useRecordMutation<TData, TVariables>(
  key: MutationKey,
  options: Omit<UseMutationOptions<TData, Error, TVariables>, "mutationKey">,
  lock?: MutationKey,
) {
  const cache = useQueryClient()
  const filters = { mutationKey: key, exact: true }
  const group = lock ? { mutationKey: lock } : filters
  const mutation = useMutation({ ...options, mutationKey: key })
  const states = useMutationState({
    filters,
    select: (item) => item.state as MutationState<TData, Error, TVariables>,
  })
  const state = states.at(-1)
  const isPending = useIsMutating(filters) > 0
  const busy = useIsMutating(group) > 0
  const mutate: UseMutateFunction<TData, Error, TVariables> = (...args) => {
    if (cache.isMutating(group) > 0) return
    mutation.mutate(...args)
  }
  return {
    mutate,
    isPending,
    busy,
    isSuccess: state?.status === "success",
    isError: state?.status === "error",
    data: state?.data,
    error: state?.error,
    variables: state?.variables,
  }
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
} from '@/api/subscriptions'
import type { CreateSubscriptionDto, UpdateSubscriptionDto } from '@/types'

export function useSubscriptions(userId: string) {
  return useQuery({
    queryKey: ['subscriptions', userId],
    queryFn: () => getSubscriptions(userId),
    enabled: !!userId,
  })
}

export function useCreateSubscription() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateSubscriptionDto) => createSubscription(dto),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions', variables.userId] })
    },
  })
}

export function useUpdateSubscription() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateSubscriptionDto }) =>
      updateSubscription(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
    },
  })
}

export function useDeleteSubscription() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteSubscription(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
    },
  })
}

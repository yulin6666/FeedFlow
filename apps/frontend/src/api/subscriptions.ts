import type { Subscription, CreateSubscriptionDto, UpdateSubscriptionDto } from '@/types'
import apiClient from './client'

export async function getSubscriptions(userId: string): Promise<Subscription[]> {
  const res = await apiClient.get<Subscription[]>('/subscriptions', {
    params: { userId },
  })
  return res.data
}

export async function createSubscription(dto: CreateSubscriptionDto): Promise<Subscription> {
  const res = await apiClient.post<Subscription>('/subscriptions', dto)
  return res.data
}

export async function updateSubscription(
  id: string,
  dto: UpdateSubscriptionDto
): Promise<Subscription> {
  const res = await apiClient.put<Subscription>(`/subscriptions/${id}`, dto)
  return res.data
}

export async function deleteSubscription(id: string): Promise<void> {
  await apiClient.delete(`/subscriptions/${id}`)
}

export async function triggerSubscription(id: string): Promise<{ executionId: string }> {
  const res = await apiClient.post<{ executionId: string }>(`/subscriptions/${id}/trigger`)
  return res.data
}

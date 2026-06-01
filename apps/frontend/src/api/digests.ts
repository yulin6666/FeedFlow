import type { Digest } from '@/types'
import apiClient from './client'

export async function getDigestsBySubscription(subscriptionId: string): Promise<Digest[]> {
  const res = await apiClient.get<Digest[]>(`/digests/subscription/${subscriptionId}`)
  return res.data
}

export async function getDigestById(id: string): Promise<Digest> {
  const res = await apiClient.get<Digest>(`/digests/${id}`)
  return res.data
}

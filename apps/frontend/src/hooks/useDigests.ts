import { useQuery } from '@tanstack/react-query'
import { getDigestsBySubscription, getDigestById } from '@/api/digests'

export function useDigests(subscriptionId: string) {
  return useQuery({
    queryKey: ['digests', subscriptionId],
    queryFn: () => getDigestsBySubscription(subscriptionId),
    enabled: !!subscriptionId,
  })
}

export function useDigest(id: string) {
  return useQuery({
    queryKey: ['digest', id],
    queryFn: () => getDigestById(id),
    enabled: !!id,
  })
}

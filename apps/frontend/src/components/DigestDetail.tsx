import React from 'react'
import { cn } from '@/lib/utils'
import type { Digest, Subscription } from '@/types'
import { SOURCE_META } from '@/lib/constants'
import { DigestCard } from './DigestCard'
import { useDigests } from '@/hooks/useDigests'
import { Loader2, FileText } from 'lucide-react'

interface DigestDetailProps {
  subscription: Subscription
  onSelectDigest: (digest: Digest) => void
}

export function DigestDetail({ subscription, onSelectDigest }: DigestDetailProps) {
  const { data: digests, isLoading, error } = useDigests(subscription.id)
  const meta = SOURCE_META[subscription.source]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-600">
        加载失败：{error.message}
      </div>
    )
  }

  if (!digests || digests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
        <FileText className="h-10 w-10 mb-3" />
        <p className="text-sm">暂无摘要记录</p>
        <p className="text-xs mt-1">订阅后将自动生成摘要</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className={cn('text-xs font-medium mb-3', meta.textClass)}>
        共 {digests.length} 条摘要
      </div>
      {digests.map((digest) => (
        <DigestCard key={digest.id} digest={digest} onClick={onSelectDigest} />
      ))}
    </div>
  )
}

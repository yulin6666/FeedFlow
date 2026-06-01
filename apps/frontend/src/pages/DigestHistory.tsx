import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { SOURCE_META, FEED_SOURCES } from '@/lib/constants'
import type { FeedSource, Subscription, Digest } from '@/types'
import { useSubscriptions } from '@/hooks/useSubscriptions'
import { useDigests } from '@/hooks/useDigests'
import { DigestCard } from '@/components/DigestCard'
import { Loader2, History, FileText } from 'lucide-react'

interface DigestHistoryProps {
  userId: string
}

function SubscriptionDigests({
  subscription,
  onSelectDigest,
}: {
  subscription: Subscription
  onSelectDigest: (digest: Digest) => void
}) {
  const { data: digests, isLoading } = useDigests(subscription.id)
  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin text-zinc-400 mx-auto my-2" />
  if (!digests || digests.length === 0) return null
  return (
    <div className="space-y-2">
      {digests.map((d) => (
        <DigestCard key={d.id} digest={d} onClick={onSelectDigest} />
      ))}
    </div>
  )
}

export default function DigestHistory({ userId }: DigestHistoryProps) {
  const { data: subscriptions, isLoading } = useSubscriptions(userId)
  const [activeSource, setActiveSource] = useState<FeedSource | 'all'>('all')
  const [selectedDigest, setSelectedDigest] = useState<Digest | null>(null)

  const filteredSubs = (subscriptions ?? []).filter(
    (s) => activeSource === 'all' || s.source === activeSource
  )

  const subscribedSources = [...new Set((subscriptions ?? []).map((s) => s.source))]

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center gap-2">
          <History className="h-6 w-6 text-zinc-900" />
          <h1 className="text-2xl font-bold text-zinc-900">摘要历史</h1>
        </div>

        {/* Source Tabs */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveSource('all')}
            className={cn(
              'shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              activeSource === 'all'
                ? 'bg-zinc-900 text-white'
                : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'
            )}
          >
            全部
          </button>
          {subscribedSources.map((source) => {
            const meta = SOURCE_META[source]
            return (
              <button
                key={source}
                onClick={() => setActiveSource(source)}
                className={cn(
                  'shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                  activeSource === source
                    ? `${meta.badgeClass} border-0`
                    : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                )}
              >
                {meta.icon} {meta.label}
              </button>
            )
          })}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        )}

        {!isLoading && filteredSubs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
            <FileText className="h-10 w-10 mb-3" />
            <p className="text-sm">暂无摘要记录</p>
          </div>
        )}

        {filteredSubs.map((sub) => {
          const meta = SOURCE_META[sub.source]
          return (
            <div key={sub.id} className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span>{meta.icon}</span>
                <h2 className={cn('text-sm font-semibold', meta.textClass)}>{meta.label}</h2>
              </div>
              <SubscriptionDigests subscription={sub} onSelectDigest={setSelectedDigest} />
            </div>
          )
        })}
      </div>

      {/* Digest Detail Panel */}
      {selectedDigest && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/40" onClick={() => setSelectedDigest(null)} />
          <div className="w-full max-w-lg bg-white shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-zinc-100 px-5 py-4 flex items-center justify-between">
              <span className="font-semibold text-zinc-900">摘要详情</span>
              <button
                onClick={() => setSelectedDigest(null)}
                className="text-zinc-400 hover:text-zinc-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-xs text-zinc-400">
                {new Date(selectedDigest.createdAt).toLocaleString('zh-CN')}
              </div>
              {selectedDigest.summary && (
                <div className="p-4 bg-zinc-50 rounded-lg">
                  <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">摘要</div>
                  <p className="text-sm text-zinc-700">{selectedDigest.summary}</p>
                </div>
              )}
              {selectedDigest.content && (
                <div>
                  <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">完整内容</div>
                  <div className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">
                    {selectedDigest.content}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

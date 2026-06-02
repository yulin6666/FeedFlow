import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { SOURCE_META, FEED_SOURCES, FREQUENCY_LABELS } from '@/lib/constants'
import type { FeedSource, Subscription, Digest } from '@/types'
import { useSubscriptions, useCreateSubscription, useUpdateSubscription, useDeleteSubscription, useTriggerSubscription } from '@/hooks/useSubscriptions'
import { SourceSelector } from '@/components/SourceSelector'
import { SubscriptionCard } from '@/components/SubscriptionCard'
import { DigestDetail } from '@/components/DigestDetail'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Rss, BookOpen, ExternalLink, ArrowLeft } from 'lucide-react'
import type { Frequency } from '@/types'

interface HomeProps {
  userId: string
}

interface ContentItem {
  title: string
  url: string
  summary: string
  score?: number
  author?: string
  tags?: string[]
}

function parseContent(content?: string): ContentItem[] {
  if (!content) return []
  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed)) return parsed
  } catch {}
  return []
}

export default function Home({ userId }: HomeProps) {
  const { toast } = useToast()
  const { data: subscriptions, isLoading, error } = useSubscriptions(userId)
  const createMutation = useCreateSubscription()
  const updateMutation = useUpdateSubscription()
  const deleteMutation = useDeleteSubscription()
  const triggerMutation = useTriggerSubscription()

  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null)
  const [selectedDigest, setSelectedDigest] = useState<Digest | null>(null)

  const subscribedSources = (subscriptions ?? []).map((s) => s.source)

  const handleSubscribe = async (source: FeedSource, frequency: Frequency) => {
    const meta = SOURCE_META[source]
    try {
      await createMutation.mutateAsync({
        userId,
        name: meta.label,
        source,
        sourceUrl: meta.url,
        frequency,
      })
      toast({ title: '订阅成功', description: `已订阅 ${meta.label}` })
    } catch (e) {
      toast({ title: '订阅失败', description: (e as Error).message, variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id)
      if (selectedSub?.id === id) setSelectedSub(null)
      toast({ title: '已删除订阅' })
    } catch (e) {
      toast({ title: '删除失败', description: (e as Error).message, variant: 'destructive' })
    }
  }

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await updateMutation.mutateAsync({ id, dto: { isActive } })
    } catch (e) {
      toast({ title: '操作失败', description: (e as Error).message, variant: 'destructive' })
    }
  }

  const handleTrigger = async (id: string) => {
    try {
      await triggerMutation.mutateAsync(id)
      toast({ title: '已触发更新', description: '摘要生成中，稍后刷新查看' })
    } catch (e) {
      toast({ title: '触发失败', description: (e as Error).message, variant: 'destructive' })
    }
  }

  const meta = selectedSub ? SOURCE_META[selectedSub.source] : null
  const items = parseContent(selectedDigest?.content)

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Rss className="h-6 w-6 text-zinc-900" />
            <h1 className="text-2xl font-bold text-zinc-900">FeedFlow</h1>
          </div>
          <p className="text-zinc-500 text-sm">订阅你感兴趣的信息源，自动生成 AI 摘要</p>
        </div>

        {/* Add Subscription */}
        <section className="mb-8">
          <h2 className="text-base font-semibold text-zinc-900 mb-3">添加订阅</h2>
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <SourceSelector
              subscribedSources={subscribedSources}
              onSubscribe={handleSubscribe}
              isLoading={createMutation.isPending}
            />
          </div>
        </section>

        {/* My Subscriptions */}
        <section>
          <h2 className="text-base font-semibold text-zinc-900 mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            我的订阅
            {subscriptions && (
              <span className="text-xs font-normal text-zinc-400">({subscriptions.length})</span>
            )}
          </h2>

          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-600">
              加载失败：{error.message}
            </div>
          )}

          {!isLoading && !error && subscriptions?.length === 0 && (
            <div className="rounded-xl border-2 border-dashed border-zinc-200 p-8 text-center">
              <Rss className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-zinc-400">还没有订阅，从上方选择数据源开始吧</p>
            </div>
          )}

          {subscriptions && subscriptions.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {subscriptions.map((sub) => (
                <SubscriptionCard
                  key={sub.id}
                  subscription={sub}
                  onDelete={handleDelete}
                  onToggle={handleToggle}
                  onViewDigests={setSelectedSub}
                  onTrigger={handleTrigger}
                  isDeleting={deleteMutation.isPending}
                  isTriggering={triggerMutation.isPending && triggerMutation.variables === sub.id}
                />
              ))}
            </div>
          )}
        </section>

        {/* Digest Panel */}
        {selectedSub && meta && (
          <div className="fixed inset-0 z-40 flex">
            <div
              className="flex-1 bg-black/40 backdrop-blur-sm"
              onClick={() => { setSelectedSub(null); setSelectedDigest(null) }}
            />
            <div className="w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden">
              {/* Panel Header */}
              <div className="shrink-0 border-b border-zinc-100 px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{meta.icon}</span>
                  <div>
                    <div className="font-semibold text-zinc-900 text-sm leading-tight">
                      {meta.label} 摘要
                    </div>
                    {selectedDigest && (
                      <div className="text-xs text-zinc-400 mt-0.5">
                        {new Date(selectedDigest.createdAt).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedSub(null); setSelectedDigest(null) }}
                  className="w-7 h-7 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors text-lg leading-none"
                >
                  ×
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {selectedDigest ? (
                  <div className="p-5">
                    {/* Back */}
                    <button
                      onClick={() => setSelectedDigest(null)}
                      className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-700 mb-5 transition-colors"
                    >
                      <ArrowLeft className="h-3 w-3" />
                      返回列表
                    </button>

                    {/* Summary card */}
                    {selectedDigest.summary && (
                      <div className={cn('rounded-xl p-4 mb-5 border', meta.borderClass, meta.bgClass.replace('hover:bg-orange-100', '').replace('hover:bg-red-100', '').replace('hover:bg-gray-100', '').replace('hover:bg-indigo-100', ''))}>
                        <div className={cn('text-xs font-semibold uppercase tracking-wide mb-2', meta.textClass)}>
                          AI 总结
                        </div>
                        <p className="text-sm text-zinc-700 leading-relaxed">
                          {selectedDigest.summary}
                        </p>
                      </div>
                    )}

                    {/* Article list */}
                    {items.length > 0 ? (
                      <div>
                        <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">
                          {items.length} 篇文章
                        </div>
                        <div className="space-y-3">
                          {items.map((item, i) => (
                            <a
                              key={i}
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group block rounded-xl border border-zinc-100 bg-zinc-50 hover:bg-white hover:border-zinc-200 hover:shadow-sm p-4 transition-all"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <span className="text-xs font-mono text-zinc-300 shrink-0">
                                      {String(i + 1).padStart(2, '0')}
                                    </span>
                                    <h3 className="text-sm font-medium text-zinc-900 leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">
                                      {item.title}
                                    </h3>
                                  </div>
                                  {item.summary && (
                                    <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2 ml-6">
                                      {item.summary}
                                    </p>
                                  )}
                                  {(item.score !== undefined || item.author || (item.tags && item.tags.length > 0)) && (
                                    <div className="flex items-center gap-2 mt-2 ml-6 flex-wrap">
                                      {item.score !== undefined && (
                                        <span className="text-xs text-zinc-400">▲ {item.score}</span>
                                      )}
                                      {item.author && (
                                        <span className="text-xs text-zinc-400">{item.author}</span>
                                      )}
                                      {item.tags?.slice(0, 2).map((tag) => (
                                        <span key={tag} className={cn('text-xs px-1.5 py-0.5 rounded-md', meta.badgeClass)}>
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <ExternalLink className="h-3.5 w-3.5 text-zinc-300 group-hover:text-blue-400 shrink-0 mt-0.5 transition-colors" />
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : selectedDigest.content ? (
                      <div className="text-sm text-zinc-600 leading-relaxed whitespace-pre-wrap">
                        {selectedDigest.content}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="p-5">
                    <DigestDetail
                      subscription={selectedSub}
                      onSelectDigest={setSelectedDigest}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

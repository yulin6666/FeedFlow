import React from 'react'
import { cn } from '@/lib/utils'
import { SOURCE_META, FREQUENCY_LABELS } from '@/lib/constants'
import type { Subscription } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Trash2, ToggleLeft, ToggleRight, RefreshCw } from 'lucide-react'

interface SubscriptionCardProps {
  subscription: Subscription
  onDelete: (id: string) => void
  onToggle: (id: string, isActive: boolean) => void
  onViewDigests: (subscription: Subscription) => void
  onTrigger: (id: string) => void
  isDeleting?: boolean
  isTriggering?: boolean
}

export function SubscriptionCard({
  subscription,
  onDelete,
  onToggle,
  onViewDigests,
  onTrigger,
  isDeleting,
  isTriggering,
}: SubscriptionCardProps) {
  const meta = SOURCE_META[subscription.source]

  return (
    <div
      className={cn(
        'relative rounded-xl border-2 p-4 transition-all',
        subscription.isActive ? meta.borderClass : 'border-zinc-100',
        subscription.isActive ? meta.bgClass.split(' ')[0] : 'bg-zinc-50'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{meta.icon}</span>
          <div>
            <div className={cn('font-semibold text-sm', meta.textClass)}>{meta.label}</div>
            <div className="text-xs text-zinc-500 mt-0.5">
              {FREQUENCY_LABELS[subscription.frequency]}更新
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onTrigger(subscription.id)}
            disabled={isTriggering || !subscription.isActive}
            className="p-1 rounded hover:bg-white/60 transition-colors disabled:opacity-40"
            title="立刻更新"
          >
            <RefreshCw className={cn('h-4 w-4 text-zinc-400 hover:text-zinc-600', isTriggering && 'animate-spin')} />
          </button>
          <button
            onClick={() => onToggle(subscription.id, !subscription.isActive)}
            className="p-1 rounded hover:bg-white/60 transition-colors"
            title={subscription.isActive ? '暂停订阅' : '恢复订阅'}
          >
            {subscription.isActive ? (
              <ToggleRight className={cn('h-5 w-5', meta.textClass)} />
            ) : (
              <ToggleLeft className="h-5 w-5 text-zinc-400" />
            )}
          </button>
          <button
            onClick={() => onDelete(subscription.id)}
            disabled={isDeleting}
            className="p-1 rounded hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors"
            title="删除订阅"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Badge
          className={cn('text-xs', meta.badgeClass, 'border-0')}
          variant="secondary"
        >
          {subscription.isActive ? '订阅中' : '已暂停'}
        </Badge>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs text-zinc-500 hover:text-zinc-900"
          onClick={() => onViewDigests(subscription)}
        >
          查看摘要 →
        </Button>
      </div>
    </div>
  )
}

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
        'rounded-2xl border-2 p-5 transition-all bg-white shadow-sm',
        subscription.isActive ? meta.borderClass : 'border-zinc-100'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="flex items-center gap-3">
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-xl', meta.bgClass.split(' ')[0])}>
            {meta.icon}
          </div>
          <div>
            <div className={cn('font-bold text-base', meta.textClass)}>{meta.label}</div>
            <div className="text-xs text-zinc-400 mt-0.5">
              {FREQUENCY_LABELS[subscription.frequency]} digest · via n8n
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onTrigger(subscription.id)}
            disabled={isTriggering || !subscription.isActive}
            className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors disabled:opacity-40"
            title="Trigger now"
          >
            <RefreshCw className={cn('h-4 w-4 text-zinc-400', isTriggering && 'animate-spin')} />
          </button>
          <button
            onClick={() => onToggle(subscription.id, !subscription.isActive)}
            className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors"
            title={subscription.isActive ? 'Pause' : 'Resume'}
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
            className="p-1.5 rounded-lg hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* n8n Workflow Diagram */}
      <div className="rounded-xl bg-zinc-50 border border-zinc-100 p-4 mb-4">
        <div className="flex items-center gap-1.5 mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
          <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">n8n Workflow</span>
          {subscription.isActive && (
            <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-500 font-medium">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              Active
            </span>
          )}
        </div>

        {/* Nodes */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {/* Schedule Trigger */}
          <div className="shrink-0 flex flex-col items-center gap-1.5">
            <div className="w-12 h-12 rounded-xl bg-orange-500 flex items-center justify-center shadow-sm">
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/>
              </svg>
            </div>
            <span className="text-[9px] text-zinc-500 font-medium text-center leading-tight">Schedule<br/>Trigger</span>
          </div>

          {/* Arrow */}
          <div className="shrink-0 flex items-center pb-4">
            <div className="w-6 h-px bg-zinc-300" />
            <div className="w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[6px] border-l-zinc-300" />
          </div>

          {/* Fetch */}
          <div className="shrink-0 flex flex-col items-center gap-1.5">
            <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center shadow-sm">
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
              </svg>
            </div>
            <span className="text-[9px] text-zinc-500 font-medium text-center leading-tight">Fetch<br/>Articles</span>
          </div>

          {/* Arrow */}
          <div className="shrink-0 flex items-center pb-4">
            <div className="w-6 h-px bg-zinc-300" />
            <div className="w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[6px] border-l-zinc-300" />
          </div>

          {/* AI */}
          <div className="shrink-0 flex flex-col items-center gap-1.5">
            <div className="w-12 h-12 rounded-xl bg-violet-500 flex items-center justify-center shadow-sm">
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
              </svg>
            </div>
            <span className="text-[9px] text-zinc-500 font-medium text-center leading-tight">AI<br/>Summarize</span>
          </div>

          {/* Arrow */}
          <div className="shrink-0 flex items-center pb-4">
            <div className="w-6 h-px bg-zinc-300" />
            <div className="w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[6px] border-l-zinc-300" />
          </div>

          {/* Parse */}
          <div className="shrink-0 flex flex-col items-center gap-1.5">
            <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center shadow-sm">
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white" xmlns="http://www.w3.org/2000/svg">
                <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
              </svg>
            </div>
            <span className="text-[9px] text-zinc-500 font-medium text-center leading-tight">Parse<br/>Response</span>
          </div>

          {/* Arrow */}
          <div className="shrink-0 flex items-center pb-4">
            <div className="w-6 h-px bg-zinc-300" />
            <div className="w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[6px] border-l-zinc-300" />
          </div>

          {/* Callback */}
          <div className="shrink-0 flex flex-col items-center gap-1.5">
            <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center shadow-sm">
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
              </svg>
            </div>
            <span className="text-[9px] text-zinc-500 font-medium text-center leading-tight">Webhook<br/>Callback</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2">
        <Badge
          className={cn('text-xs', meta.badgeClass, 'border-0')}
          variant="secondary"
        >
          {subscription.isActive ? 'Active' : 'Paused'}
        </Badge>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs text-zinc-500 hover:text-zinc-900"
          onClick={() => onViewDigests(subscription)}
        >
          View digests →
        </Button>
      </div>
    </div>
  )
}

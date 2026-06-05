import React from 'react'
import { cn } from '@/lib/utils'
import type { Digest } from '@/types'
import { Clock, CheckCircle, XCircle, Loader2, FileText } from 'lucide-react'

interface DigestCardProps {
  digest: Digest
  onClick: (digest: Digest) => void
}

const statusConfig = {
  pending: { icon: Clock, label: 'Pending', className: 'text-yellow-500' },
  processing: { icon: Loader2, label: 'Processing', className: 'text-blue-500 animate-spin' },
  completed: { icon: CheckCircle, label: 'Completed', className: 'text-green-500' },
  failed: { icon: XCircle, label: 'Failed', className: 'text-red-500' },
}

export function DigestCard({ digest, onClick }: DigestCardProps) {
  const config = statusConfig[digest.status]
  const StatusIcon = config.icon
  const date = new Date(digest.createdAt)
  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <button
      onClick={() => onClick(digest)}
      disabled={digest.status !== 'completed'}
      className={cn(
        'w-full text-left rounded-lg border border-zinc-200 bg-white p-4 transition-all',
        digest.status === 'completed'
          ? 'hover:border-zinc-300 hover:shadow-sm cursor-pointer'
          : 'cursor-default opacity-70'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-zinc-400 shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-zinc-900 truncate">
              {digest.summary
                ? digest.summary.slice(0, 60) + (digest.summary.length > 60 ? '...' : '')
                : `Digest ${digest.id.slice(0, 8)}`}
            </div>
            <div className="text-xs text-zinc-400 mt-0.5">{dateStr}</div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <StatusIcon className={cn('h-4 w-4', config.className)} />
          <span className="text-xs text-zinc-500">{config.label}</span>
        </div>
      </div>
    </button>
  )
}

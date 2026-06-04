import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { SOURCE_META, FEED_SOURCES, FREQUENCY_LABELS } from '@/lib/constants'
import type { FeedSource, Frequency } from '@/types'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'

interface SourceSelectorProps {
  subscribedSources: FeedSource[]
  onSubscribe: (source: FeedSource, frequency: Frequency) => void
  isLoading?: boolean
}

export function SourceSelector({ subscribedSources, onSubscribe, isLoading }: SourceSelectorProps) {
  const [selected, setSelected] = useState<FeedSource | null>(null)
  const [frequency, setFrequency] = useState<Frequency>('monthly')

  const handleSubscribe = () => {
    if (!selected) return
    onSubscribe(selected, frequency)
    setSelected(null)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {FEED_SOURCES.map((source) => {
          const meta = SOURCE_META[source]
          const isSubscribed = subscribedSources.includes(source)
          const isActive = selected === source
          return (
            <button
              key={source}
              disabled={isSubscribed}
              onClick={() => setSelected(isActive ? null : source)}
              className={cn(
                'relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all',
                isSubscribed
                  ? 'cursor-not-allowed border-zinc-100 bg-zinc-50 opacity-50'
                  : isActive
                  ? `border-current ${meta.textClass} ${meta.bgClass}`
                  : `border-transparent ${meta.bgClass} hover:border-current ${meta.textClass}`
              )}
            >
              {isSubscribed && (
                <span className="absolute right-2 top-2">
                  <Check className="h-3.5 w-3.5 text-green-500" />
                </span>
              )}
              <span className="text-2xl">{meta.icon}</span>
              <span className={cn('text-xs font-medium', meta.textClass)}>{meta.label}</span>
            </button>
          )
        })}
      </div>

      {selected && (
        <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <span className="text-sm text-zinc-600">订阅频率：</span>
          <div className="flex gap-2">
            {(['monthly'] as Frequency[]).map((f) => (
              <button
                key={f}
                onClick={() => setFrequency(f)}
                className={cn(
                  'rounded-md px-3 py-1 text-sm font-medium transition-colors',
                  frequency === f
                    ? 'bg-zinc-900 text-white'
                    : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-100'
                )}
              >
                {FREQUENCY_LABELS[f]}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            onClick={handleSubscribe}
            disabled={isLoading}
            className="ml-auto"
          >
            {isLoading ? '订阅中...' : '订阅'}
          </Button>
        </div>
      )}
    </div>
  )
}

import type { FeedSource } from '@/types'

export interface SourceMeta {
  label: string
  url: string
  color: string
  bgClass: string
  textClass: string
  borderClass: string
  badgeClass: string
  icon: string
}

export const SOURCE_META: Record<FeedSource, SourceMeta> = {
  devto: {
    label: 'Dev.to',
    url: 'https://dev.to',
    color: 'indigo',
    bgClass: 'bg-indigo-50 hover:bg-indigo-100',
    textClass: 'text-indigo-700',
    borderClass: 'border-indigo-200',
    badgeClass: 'bg-indigo-100 text-indigo-700',
    icon: '📝',
  },
}

export const FEED_SOURCES = Object.keys(SOURCE_META) as FeedSource[]

export const FREQUENCY_LABELS: Record<string, string> = {
  monthly: 'Monthly',
}

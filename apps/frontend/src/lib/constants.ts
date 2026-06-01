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
  hacker_news: {
    label: 'Hacker News',
    url: 'https://news.ycombinator.com',
    color: 'orange',
    bgClass: 'bg-orange-50 hover:bg-orange-100',
    textClass: 'text-orange-700',
    borderClass: 'border-orange-200',
    badgeClass: 'bg-orange-100 text-orange-700',
    icon: '🔥',
  },
  product_hunt: {
    label: 'Product Hunt',
    url: 'https://www.producthunt.com',
    color: 'red',
    bgClass: 'bg-red-50 hover:bg-red-100',
    textClass: 'text-red-700',
    borderClass: 'border-red-200',
    badgeClass: 'bg-red-100 text-red-700',
    icon: '🚀',
  },
  github_trending: {
    label: 'GitHub Trending',
    url: 'https://github.com/trending',
    color: 'gray',
    bgClass: 'bg-gray-50 hover:bg-gray-100',
    textClass: 'text-gray-700',
    borderClass: 'border-gray-200',
    badgeClass: 'bg-gray-100 text-gray-700',
    icon: '⭐',
  },
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
  daily: '每日',
  weekly: '每周',
}

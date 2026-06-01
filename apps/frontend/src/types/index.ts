export type FeedSource = 'hacker_news' | 'product_hunt' | 'github_trending' | 'devto'
export type Frequency = 'daily' | 'weekly'
export type DigestStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface Subscription {
  id: string
  userId: string
  name: string
  source: FeedSource
  sourceUrl: string
  frequency: Frequency
  isActive: boolean
  n8nWorkflowId?: string
  createdAt: string
  updatedAt: string
}

export interface Digest {
  id: string
  subscriptionId: string
  status: DigestStatus
  content?: string
  summary?: string
  createdAt: string
  updatedAt?: string
}

export interface CreateSubscriptionDto {
  userId: string
  name: string
  source: FeedSource
  sourceUrl: string
  frequency: Frequency
}

export interface UpdateSubscriptionDto {
  frequency?: Frequency
  isActive?: boolean
}

export interface ApiResponse<T> {
  data: T
  message?: string
}

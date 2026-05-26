export enum FeedSource {
  RSS = 'rss',
  TWITTER = 'twitter',
  GITHUB = 'github',
  HACKER_NEWS = 'hacker_news',
  REDDIT = 'reddit',
  NEWSLETTER = 'newsletter',
}

export enum Frequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  REALTIME = 'realtime',
}

export enum DigestStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

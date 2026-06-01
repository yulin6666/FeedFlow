import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum FeedSource {
  HACKER_NEWS = 'hacker_news',
  PRODUCT_HUNT = 'product_hunt',
  GITHUB_TRENDING = 'github_trending',
  DEVTO = 'devto',
}

export enum Frequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  REALTIME = 'realtime',
}

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: FeedSource })
  source: FeedSource;

  @Column()
  sourceUrl: string;

  @Column({ type: 'enum', enum: Frequency, default: Frequency.DAILY })
  frequency: Frequency;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @Column({ nullable: true })
  n8nWorkflowId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

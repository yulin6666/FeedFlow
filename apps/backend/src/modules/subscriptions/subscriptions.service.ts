import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from './subscription.entity';
import { CreateSubscriptionDto, UpdateSubscriptionDto } from './subscriptions.dto';
import { N8nService } from '../n8n/n8n.service';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    private readonly n8nService: N8nService,
  ) {}

  async findAll(userId?: string): Promise<Subscription[]> {
    const where = userId ? { userId } : {};
    return this.subscriptionRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepo.findOne({ where: { id } });
    if (!subscription) {
      throw new NotFoundException(`Subscription ${id} not found`);
    }
    return subscription;
  }

  async create(dto: CreateSubscriptionDto): Promise<Subscription> {
    const subscription = this.subscriptionRepo.create(dto);
    const saved = await this.subscriptionRepo.save(subscription);

    // 异步创建 n8n 工作流，不阻塞响应
    this.n8nService
      .createWorkflow(saved.id, saved.source, saved.frequency)
      .then((workflowId) => {
        saved.n8nWorkflowId = workflowId;
        return this.subscriptionRepo.save(saved);
      })
      .catch((err) => {
        this.logger.error(`Failed to create n8n workflow for subscription ${saved.id}`, err);
      });

    return saved;
  }

  async update(id: string, dto: UpdateSubscriptionDto): Promise<Subscription> {
    const subscription = await this.findOne(id);
    const oldFrequency = subscription.frequency;
    Object.assign(subscription, dto);
    const updated = await this.subscriptionRepo.save(subscription);

    // 如果频率变了且有工作流，同步更新 cron
    if (dto.frequency && dto.frequency !== oldFrequency && updated.n8nWorkflowId) {
      this.n8nService
        .updateWorkflowSchedule(updated.n8nWorkflowId, updated.frequency)
        .catch((err) => {
          this.logger.error(`Failed to update n8n workflow schedule for ${updated.n8nWorkflowId}`, err);
        });
    }

    return updated;
  }

  async remove(id: string): Promise<void> {
    const subscription = await this.findOne(id);

    // 先删 n8n 工作流
    if (subscription.n8nWorkflowId) {
      await this.n8nService.deleteWorkflow(subscription.n8nWorkflowId).catch((err) => {
        this.logger.warn(`Failed to delete n8n workflow ${subscription.n8nWorkflowId}`, err);
      });
    }

    await this.subscriptionRepo.remove(subscription);
  }

  async triggerWorkflow(id: string): Promise<{ executionId: string }> {
    const subscription = await this.findOne(id);
    if (!subscription.n8nWorkflowId) {
      throw new NotFoundException(`No n8n workflow linked to subscription ${id}`);
    }
    const executionId = await this.n8nService.triggerWorkflow(subscription.id);
    return { executionId };
  }
}

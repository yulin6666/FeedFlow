import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from './subscription.entity';
import { CreateSubscriptionDto, UpdateSubscriptionDto } from './subscriptions.dto';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
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
    return this.subscriptionRepo.save(subscription);
  }

  async update(id: string, dto: UpdateSubscriptionDto): Promise<Subscription> {
    const subscription = await this.findOne(id);
    Object.assign(subscription, dto);
    return this.subscriptionRepo.save(subscription);
  }

  async remove(id: string): Promise<void> {
    const subscription = await this.findOne(id);
    await this.subscriptionRepo.remove(subscription);
  }

  async setWorkflowId(id: string, workflowId: string): Promise<Subscription> {
    const subscription = await this.findOne(id);
    subscription.n8nWorkflowId = workflowId;
    return this.subscriptionRepo.save(subscription);
  }
}

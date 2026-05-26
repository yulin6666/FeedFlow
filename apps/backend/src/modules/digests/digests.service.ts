import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Digest, DigestStatus } from './digest.entity';

@Injectable()
export class DigestsService {
  constructor(
    @InjectRepository(Digest)
    private readonly digestRepo: Repository<Digest>,
  ) {}

  async findBySubscription(subscriptionId: string): Promise<Digest[]> {
    return this.digestRepo.find({
      where: { subscriptionId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Digest> {
    const digest = await this.digestRepo.findOne({ where: { id } });
    if (!digest) {
      throw new NotFoundException(`Digest ${id} not found`);
    }
    return digest;
  }

  async create(subscriptionId: string): Promise<Digest> {
    const digest = this.digestRepo.create({ subscriptionId });
    return this.digestRepo.save(digest);
  }

  async updateStatus(
    id: string,
    status: DigestStatus,
    data?: { content?: string; summary?: string; rawItems?: Record<string, unknown>[]; n8nExecutionId?: string; errorMessage?: string },
  ): Promise<Digest> {
    const digest = await this.findOne(id);
    Object.assign(digest, { status, ...data });
    return this.digestRepo.save(digest);
  }
}

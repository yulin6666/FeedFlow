import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { FeedSource, Frequency } from '../subscriptions/subscription.entity';
import { buildWorkflow, getWebhookPath } from './workflow-templates';

@Injectable()
export class N8nService {
  private readonly logger = new Logger(N8nService.name);
  private readonly client: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    const baseURL = this.configService.get<string>('n8n.baseUrl') ?? process.env.N8N_BASE_URL ?? 'http://localhost:5678';
    const apiKey = this.configService.get<string>('n8n.apiKey') ?? process.env.N8N_API_KEY ?? '';

    this.logger.log(`N8n baseURL: ${baseURL}, apiKey length: ${apiKey.length}`);

    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'X-N8N-API-KEY': apiKey } : {}),
      },
    });
  }

  // ─── Workflow 管理 ──────────────────────────────────────────────────────────

  async createWorkflow(
    subscriptionId: string,
    source: FeedSource,
    frequency: Frequency,
  ): Promise<string> {
    const backendUrl = this.configService.get<string>('backendUrl') ?? 'http://localhost:3000';
    const webhookSecret = this.configService.get<string>('n8n.webhookSecret') ?? '';
    const aiApiKey =
      this.configService.get<string>('deepseekApiKey') ||
      this.configService.get<string>('claudeApiKey') ||
      '';

    const workflowDef = buildWorkflow(source, {
      subscriptionId,
      frequency,
      backendUrl,
      webhookSecret,
      aiApiKey,
      productHuntApiKey: process.env.PRODUCT_HUNT_API_KEY ?? '',
      productHuntApiSecret: process.env.PRODUCT_HUNT_API_SECRET ?? '',
    });

    const createRes = await this.client.post('/api/v1/workflows', workflowDef);
    const workflowId: string = createRes.data.id;

    // 激活工作流
    await this.client.post(`/api/v1/workflows/${workflowId}/activate`);

    this.logger.log(`Created and activated n8n workflow ${workflowId} for subscription ${subscriptionId}`);
    return workflowId;
  }

  async deleteWorkflow(workflowId: string): Promise<void> {
    await this.client.delete(`/api/v1/workflows/${workflowId}`);
    this.logger.log(`Deleted n8n workflow ${workflowId}`);
  }

  async triggerWorkflow(subscriptionId: string): Promise<string> {
    const baseURL = this.configService.get<string>('n8n.baseUrl');
    const webhookPath = getWebhookPath(subscriptionId);
    const res = await axios.post(`${baseURL}/webhook/${webhookPath}`, { trigger: 'manual' });
    return res.data?.executionId ?? 'triggered';
  }

  async updateWorkflowSchedule(workflowId: string, frequency: Frequency): Promise<void> {
    const cronMap: Record<Frequency, string> = {
      [Frequency.MONTHLY]: '0 0 8 1 * *',
    };
    const workflow = await this.client.get(`/api/v1/workflows/${workflowId}`);
    const nodes = workflow.data.nodes ?? [];
    const triggerNode = nodes.find((n: { type: string }) => n.type === 'n8n-nodes-base.scheduleTrigger');
    if (triggerNode) {
      triggerNode.parameters.rule.interval[0].expression = cronMap[frequency];
      await this.client.put(`/api/v1/workflows/${workflowId}`, { ...workflow.data, nodes });
    }
  }

  // ─── 查询接口 ───────────────────────────────────────────────────────────────

  async getWorkflows(): Promise<unknown[]> {
    const response = await this.client.get('/api/v1/workflows');
    return response.data.data ?? response.data;
  }

  async getWorkflow(workflowId: string): Promise<unknown> {
    const response = await this.client.get(`/api/v1/workflows/${workflowId}`);
    return response.data;
  }

  async getExecutions(workflowId?: string): Promise<unknown[]> {
    const params = workflowId ? { workflowId } : {};
    const response = await this.client.get('/api/v1/executions', { params });
    return response.data.data ?? response.data;
  }

  async getExecution(executionId: string): Promise<unknown> {
    const response = await this.client.get(`/api/v1/executions/${executionId}`);
    return response.data;
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.get('/api/v1/workflows');
      return true;
    } catch {
      return false;
    }
  }
}

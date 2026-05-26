import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class N8nService {
  private readonly logger = new Logger(N8nService.name);
  private readonly client: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    const baseURL = this.configService.get<string>('n8n.baseUrl');
    const apiKey = this.configService.get<string>('n8n.apiKey');

    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'X-N8N-API-KEY': apiKey } : {}),
      },
    });
  }

  async getWorkflows(): Promise<unknown[]> {
    const response = await this.client.get('/api/v1/workflows');
    return response.data.data ?? response.data;
  }

  async getWorkflow(workflowId: string): Promise<unknown> {
    const response = await this.client.get(`/api/v1/workflows/${workflowId}`);
    return response.data;
  }

  async activateWorkflow(workflowId: string): Promise<unknown> {
    const response = await this.client.post(`/api/v1/workflows/${workflowId}/activate`);
    return response.data;
  }

  async deactivateWorkflow(workflowId: string): Promise<unknown> {
    const response = await this.client.post(`/api/v1/workflows/${workflowId}/deactivate`);
    return response.data;
  }

  async triggerWebhook(webhookPath: string, payload: unknown): Promise<unknown> {
    try {
      const response = await this.client.post(`/webhook/${webhookPath}`, payload);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to trigger n8n webhook: ${webhookPath}`, error);
      throw error;
    }
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
}

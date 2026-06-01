import { Controller, Post, Body, Headers, UnauthorizedException, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { DigestsService } from '../digests/digests.service';
import { N8nWebhookPayloadDto } from './webhook.dto';

@ApiTags('webhook')
@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly digestsService: DigestsService,
    private readonly configService: ConfigService,
  ) {}

  @Post('n8n/digest-complete')
  @ApiOperation({ summary: 'n8n callback when a digest processing completes' })
  async handleDigestComplete(
    @Body() payload: N8nWebhookPayloadDto,
    @Headers('x-webhook-secret') secret: string,
  ) {
    const expectedSecret = this.configService.get<string>('n8n.webhookSecret');
    if (expectedSecret && secret !== expectedSecret) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    this.logger.log(`Received digest callback for subscriptionId=${payload.subscriptionId} status=${payload.status}`);

    const digest = await this.digestsService.create(payload.subscriptionId);
    await this.digestsService.updateStatus(digest.id, payload.status, {
      content: payload.content,
      summary: payload.summary,
      n8nExecutionId: payload.n8nExecutionId,
      errorMessage: payload.errorMessage,
    });

    return { received: true };
  }
}

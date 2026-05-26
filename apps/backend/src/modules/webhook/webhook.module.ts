import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { DigestsModule } from '../digests/digests.module';

@Module({
  imports: [DigestsModule],
  controllers: [WebhookController],
})
export class WebhookModule {}

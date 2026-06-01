import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DigestStatus } from '../digests/digest.entity';

export class N8nWebhookPayloadDto {
  @ApiProperty({ description: 'Subscription ID to create digest for' })
  @IsString()
  subscriptionId: string;

  @ApiProperty({ enum: DigestStatus })
  @IsEnum(DigestStatus)
  status: DigestStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  content?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  summary?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  n8nExecutionId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  errorMessage?: string;
}

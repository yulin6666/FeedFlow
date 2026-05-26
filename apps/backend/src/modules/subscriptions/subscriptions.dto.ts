import { IsString, IsEnum, IsUrl, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FeedSource, Frequency } from './subscription.entity';

export class CreateSubscriptionDto {
  @ApiProperty({ example: 'user-123' })
  @IsString()
  userId: string;

  @ApiProperty({ example: 'My RSS Feed' })
  @IsString()
  name: string;

  @ApiProperty({ enum: FeedSource })
  @IsEnum(FeedSource)
  source: FeedSource;

  @ApiProperty({ example: 'https://example.com/feed.xml' })
  @IsUrl()
  sourceUrl: string;

  @ApiPropertyOptional({ enum: Frequency, default: Frequency.DAILY })
  @IsEnum(Frequency)
  @IsOptional()
  frequency?: Frequency;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class UpdateSubscriptionDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ enum: Frequency })
  @IsEnum(Frequency)
  @IsOptional()
  frequency?: Frequency;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

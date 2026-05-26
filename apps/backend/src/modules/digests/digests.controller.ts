import { Controller, Get, Post, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DigestsService } from './digests.service';

@ApiTags('digests')
@Controller('digests')
export class DigestsController {
  constructor(private readonly digestsService: DigestsService) {}

  @Get('subscription/:subscriptionId')
  @ApiOperation({ summary: 'List digests for a subscription' })
  findBySubscription(@Param('subscriptionId') subscriptionId: string) {
    return this.digestsService.findBySubscription(subscriptionId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a digest by ID' })
  findOne(@Param('id') id: string) {
    return this.digestsService.findOne(id);
  }

  @Post('subscription/:subscriptionId')
  @ApiOperation({ summary: 'Trigger a new digest for a subscription' })
  create(@Param('subscriptionId') subscriptionId: string) {
    return this.digestsService.create(subscriptionId);
  }
}

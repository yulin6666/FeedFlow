import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { N8nService } from './n8n.service';

@ApiTags('n8n')
@Controller('n8n')
export class N8nController {
  constructor(private readonly n8nService: N8nService) {}

  @Get('workflows')
  @ApiOperation({ summary: 'List all n8n workflows' })
  getWorkflows() {
    return this.n8nService.getWorkflows();
  }

  @Get('executions')
  @ApiOperation({ summary: 'List recent executions' })
  getExecutions() {
    return this.n8nService.getExecutions();
  }

  @Get('executions/:id')
  @ApiOperation({ summary: 'Get a specific execution' })
  getExecution(@Param('id') id: string) {
    return this.n8nService.getExecution(id);
  }
}

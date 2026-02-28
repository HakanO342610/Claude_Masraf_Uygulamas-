import { Controller, Post, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SapIntegrationService } from './sap-integration.service';
import { SapQueueService } from './sap-queue.service';
import { SapMasterDataService } from './sap-master-data.service';

@ApiTags('SAP Integration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integration/sap')
export class SapIntegrationController {
  constructor(
    private sapService: SapIntegrationService,
    private queueService: SapQueueService,
    private masterDataService: SapMasterDataService,
  ) {}

  @Post('post-expense/:id')
  @Roles('FINANCE', 'ADMIN')
  @ApiOperation({ summary: 'Post approved expense to SAP' })
  postToSap(@Param('id') id: string) {
    return this.sapService.postExpenseToSap(id);
  }

  @Post('enqueue/:id')
  @Roles('FINANCE', 'ADMIN')
  @ApiOperation({ summary: 'Enqueue expense for async SAP posting' })
  enqueue(@Param('id') id: string) {
    return this.queueService.enqueue(id);
  }

  @Get('queue')
  @Roles('FINANCE', 'ADMIN')
  @ApiOperation({ summary: 'Get SAP posting queue status' })
  getQueueStatus() {
    return this.queueService.getQueueStatus();
  }

  @Post('queue/:id/retry')
  @Roles('FINANCE', 'ADMIN')
  @ApiOperation({ summary: 'Retry failed SAP posting' })
  retryQueueItem(@Param('id') id: string) {
    return this.queueService.retryItem(id);
  }

  @Get('master-data')
  @Roles('FINANCE', 'ADMIN')
  @ApiOperation({ summary: 'Get SAP master data by type' })
  @ApiQuery({ name: 'type', required: true, enum: ['COST_CENTER', 'GL_ACCOUNT', 'TAX_CODE'] })
  getMasterData(@Query('type') type: string) {
    return this.masterDataService.getByType(type);
  }

  @Post('sync')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Trigger manual SAP master data sync' })
  syncMasterData() {
    return this.masterDataService.syncAll();
  }

  @Get('test-connection')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Test SAP connectivity and credentials — returns connected:true/false' })
  testConnection() {
    return this.sapService.testConnection();
  }
}

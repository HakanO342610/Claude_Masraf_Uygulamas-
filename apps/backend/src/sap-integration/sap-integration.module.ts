import { Module } from '@nestjs/common';
import { SapIntegrationService } from './sap-integration.service';
import { SapIntegrationController } from './sap-integration.controller';
import { SapQueueService } from './sap-queue.service';
import { SapMasterDataService } from './sap-master-data.service';
import { SapAdapterFactory } from './adapters/sap-adapter.factory';

@Module({
  controllers: [SapIntegrationController],
  providers: [SapIntegrationService, SapQueueService, SapMasterDataService, SapAdapterFactory],
  exports: [SapIntegrationService, SapQueueService],
})
export class SapIntegrationModule {}

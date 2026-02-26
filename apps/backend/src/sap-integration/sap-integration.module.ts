import { Module } from '@nestjs/common';
import { SapIntegrationService } from './sap-integration.service';
import { SapIntegrationController } from './sap-integration.controller';

@Module({
  controllers: [SapIntegrationController],
  providers: [SapIntegrationService],
  exports: [SapIntegrationService],
})
export class SapIntegrationModule {}

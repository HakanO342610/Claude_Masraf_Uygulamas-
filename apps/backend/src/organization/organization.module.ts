import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IdentityModule } from '../identity/identity.module';
import { CryptoService } from '../common/crypto.service';
import { OrganizationService } from './organization.service';
import { OrganizationController } from './organization.controller';
import { DepartmentService } from './department.service';
import { DepartmentController } from './department.controller';
import { PositionService } from './position.service';
import { PositionController } from './position.controller';
import { SetupWizardController } from './setup-wizard.controller';
import { IdentityAdapterFactory } from '../identity/adapters/identity-adapter.factory';

@Module({
  imports: [PrismaModule, IdentityModule],
  providers: [CryptoService, OrganizationService, DepartmentService, PositionService, IdentityAdapterFactory],
  controllers: [OrganizationController, DepartmentController, PositionController, SetupWizardController],
  exports: [OrganizationService, DepartmentService, PositionService],
})
export class OrganizationModule {}

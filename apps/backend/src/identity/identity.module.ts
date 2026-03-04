import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CryptoService } from '../common/crypto.service';
import { IdentityAdapterFactory } from './adapters/identity-adapter.factory';
import { UserSyncService } from './user-sync.service';
import { IdentityController } from './identity.controller';

@Module({
  imports: [PrismaModule],
  providers: [CryptoService, IdentityAdapterFactory, UserSyncService],
  controllers: [IdentityController],
  exports: [UserSyncService],
})
export class IdentityModule {}

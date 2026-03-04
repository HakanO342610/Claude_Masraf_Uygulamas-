import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserSyncService } from './user-sync.service';

@ApiTags('Identity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('identity')
export class IdentityController {
  constructor(private syncService: UserSyncService) {}

  /** Manuel sync — env tabanlı (single-tenant) */
  @Post('sync')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Trigger identity sync (env-based)' })
  syncEnv() {
    return this.syncService.syncForEnv();
  }

  /** Manuel sync — belirli bir org için */
  @Post('sync/org/:orgId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Trigger identity sync for a specific organization' })
  syncOrg(@Param('orgId') orgId: string) {
    return this.syncService.syncForOrg(orgId);
  }

  /** Bağlantı testi — env tabanlı */
  @Get('test-connection')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Test identity provider connection (env-based)' })
  testConnectionEnv() {
    return this.syncService.testConnection();
  }

  /** Bağlantı testi — belirli bir org için */
  @Get('test-connection/org/:orgId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Test identity provider connection for a specific organization' })
  testConnectionOrg(@Param('orgId') orgId: string) {
    return this.syncService.testConnection(orgId);
  }
}

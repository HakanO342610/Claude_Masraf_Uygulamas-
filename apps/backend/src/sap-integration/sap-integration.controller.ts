import { Controller, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SapIntegrationService } from './sap-integration.service';

@ApiTags('SAP Integration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integration/sap')
export class SapIntegrationController {
  constructor(private sapService: SapIntegrationService) {}

  @Post('post-expense/:id')
  @Roles('FINANCE', 'ADMIN')
  @ApiOperation({ summary: 'Post approved expense to SAP' })
  postToSap(@Param('id') id: string) {
    return this.sapService.postExpenseToSap(id);
  }
}

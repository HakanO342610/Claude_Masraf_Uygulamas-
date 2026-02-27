import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApprovalsService } from './approvals.service';

@ApiTags('Approvals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('approvals')
export class ApprovalsController {
  constructor(private approvalsService: ApprovalsService) {}

  @Get('my')
  @Roles('MANAGER', 'FINANCE', 'ADMIN')
  @ApiOperation({ summary: 'Get my approval tasks' })
  getMyApprovals(
    @CurrentUser('id') userId: string,
    @Query('status') status?: string,
  ) {
    return this.approvalsService.getMyApprovals(userId, status);
  }

  @Get('expense/:expenseId')
  @Roles('MANAGER', 'FINANCE', 'ADMIN')
  @ApiOperation({ summary: 'Get approval history for an expense' })
  getApprovalHistory(@Param('expenseId') expenseId: string) {
    return this.approvalsService.getApprovalHistory(expenseId);
  }
}

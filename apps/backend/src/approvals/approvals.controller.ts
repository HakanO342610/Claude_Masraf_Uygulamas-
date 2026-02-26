import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApprovalsService } from './approvals.service';

@ApiTags('Approvals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('approvals')
export class ApprovalsController {
  constructor(private approvalsService: ApprovalsService) {}

  @Get('my')
  @ApiOperation({ summary: 'Get my approval tasks' })
  getMyApprovals(
    @CurrentUser('id') userId: string,
    @Query('status') status?: string,
  ) {
    return this.approvalsService.getMyApprovals(userId, status);
  }

  @Get('expense/:expenseId')
  @ApiOperation({ summary: 'Get approval history for an expense' })
  getApprovalHistory(@Param('expenseId') expenseId: string) {
    return this.approvalsService.getApprovalHistory(expenseId);
  }
}

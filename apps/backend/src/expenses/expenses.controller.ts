import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ExpensesService } from './expenses.service';
import { SapIntegrationService } from '../sap-integration/sap-integration.service';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/create-expense.dto';

@ApiTags('Expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(
    private expensesService: ExpensesService,
    private sapService: SapIntegrationService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create new expense' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateExpenseDto) {
    return this.expensesService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List user expenses' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  findAll(
    @CurrentUser('id') userId: string,
    @Query() query: { status?: string; fromDate?: string; toDate?: string },
  ) {
    return this.expensesService.findAll(userId, query);
  }

  @Get('all')
  @UseGuards(RolesGuard)
  @Roles('FINANCE', 'ADMIN')
  @ApiOperation({ summary: 'List ALL expenses with SAP status (FINANCE/ADMIN only)' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  findAllAdmin(
    @Query() query: { status?: string; fromDate?: string; toDate?: string },
  ) {
    return this.expensesService.findAllAdmin(query);
  }

  @Get('by-receipt/:receiptNumber')
  @UseGuards(RolesGuard)
  @Roles('FINANCE', 'ADMIN')
  @ApiOperation({ summary: 'Find expense by receipt number (FINANCE/ADMIN only)' })
  findByReceipt(@Param('receiptNumber') receiptNumber: string) {
    return this.expensesService.findByReceiptNumber(receiptNumber);
  }

  @Get('pending-approvals')
  @ApiOperation({ summary: 'Get pending approvals for current user' })
  getPendingApprovals(@CurrentUser('id') userId: string) {
    return this.expensesService.getPendingApprovals(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get expense by ID (with SAP status)' })
  findById(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    return this.expensesService.findById(id, userId, userRole);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update draft expense' })
  update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expensesService.update(id, userId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete draft expense' })
  delete(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.expensesService.delete(id, userId);
  }

  @Patch(':id/submit')
  @ApiOperation({ summary: 'Submit expense for approval' })
  submit(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.expensesService.submit(id, userId);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve expense' })
  approve(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body('comment') comment?: string,
  ) {
    return this.expensesService.approve(id, userId, comment);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject expense' })
  reject(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body('comment') comment: string,
  ) {
    return this.expensesService.reject(id, userId, comment);
  }

  @Post(':id/retry-sap')
  @UseGuards(RolesGuard)
  @Roles('FINANCE', 'ADMIN')
  @ApiOperation({ summary: 'Retry SAP posting for a FINANCE_APPROVED expense' })
  retrySap(@Param('id') id: string) {
    return this.sapService.postExpenseToSap(id);
  }

  @Post(':id/debug-sap')
  @UseGuards(RolesGuard)
  @Roles('FINANCE', 'ADMIN')
  @ApiOperation({ summary: 'Debug SAP raw post (no DB update) — for ABAP debugging' })
  debugSap(@Param('id') id: string) {
    return this.sapService.debugRawPost(id);
  }
}

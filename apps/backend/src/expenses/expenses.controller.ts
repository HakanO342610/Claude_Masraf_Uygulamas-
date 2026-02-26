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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/create-expense.dto';

@ApiTags('Expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private expensesService: ExpensesService) {}

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

  @Get('pending-approvals')
  @ApiOperation({ summary: 'Get pending approvals for current user' })
  getPendingApprovals(@CurrentUser('id') userId: string) {
    return this.expensesService.getPendingApprovals(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get expense by ID' })
  findById(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.expensesService.findById(id, userId);
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
}

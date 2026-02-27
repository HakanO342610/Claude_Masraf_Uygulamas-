import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('summary')
  @Roles('MANAGER', 'FINANCE', 'ADMIN')
  @ApiOperation({ summary: 'Get expense summary report' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getSummary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.getSummary(from, to);
  }

  @Get('by-department')
  @Roles('MANAGER', 'FINANCE', 'ADMIN')
  @ApiOperation({ summary: 'Get expenses grouped by department' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getByDepartment(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.getByDepartment(from, to);
  }

  @Get('by-category')
  @Roles('MANAGER', 'FINANCE', 'ADMIN')
  @ApiOperation({ summary: 'Get expenses grouped by category' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getByCategory(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.getByCategory(from, to);
  }

  @Get('monthly')
  @Roles('MANAGER', 'FINANCE', 'ADMIN')
  @ApiOperation({ summary: 'Get monthly expense trend' })
  @ApiQuery({ name: 'year', required: false })
  getMonthly(@Query('year') year?: string) {
    return this.reportsService.getMonthly(year ? parseInt(year) : undefined);
  }

  @Get('export/csv')
  @Roles('MANAGER', 'FINANCE', 'ADMIN')
  @ApiOperation({ summary: 'Export expenses as CSV' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  async exportCsv(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Res() res?: Response,
  ) {
    const csv = await this.reportsService.exportCsv(from, to);
    res!.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res!.setHeader('Content-Disposition', `attachment; filename=expenses-report-${new Date().toISOString().split('T')[0]}.csv`);
    res!.send('\uFEFF' + csv);
  }
}

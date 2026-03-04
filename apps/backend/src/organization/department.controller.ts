import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { DepartmentService } from './department.service';

@ApiTags('Departments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('departments')
export class DepartmentController {
  constructor(private deptService: DepartmentService) {}

  @Get('tree')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get department tree (hierarchical)' })
  @ApiQuery({ name: 'orgId', required: false })
  findTree(@Query('orgId') orgId?: string) {
    return this.deptService.findTree(orgId);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'List all departments (flat)' })
  @ApiQuery({ name: 'orgId', required: false })
  findAll(@Query('orgId') orgId?: string) {
    return this.deptService.findAll(orgId);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get department by id with children, positions, users' })
  findOne(@Param('id') id: string) {
    return this.deptService.findOne(id);
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create department (standalone mode)' })
  create(@Body() body: any) {
    return this.deptService.create(body);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update department' })
  update(@Param('id') id: string, @Body() body: any) {
    return this.deptService.update(id, body);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete department (no children/users allowed)' })
  remove(@Param('id') id: string) {
    return this.deptService.remove(id);
  }
}

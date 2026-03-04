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
import { PositionService } from './position.service';

@ApiTags('Positions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('positions')
export class PositionController {
  constructor(private posService: PositionService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'List all positions' })
  @ApiQuery({ name: 'orgId', required: false })
  @ApiQuery({ name: 'departmentId', required: false })
  findAll(@Query('orgId') orgId?: string, @Query('departmentId') departmentId?: string) {
    return this.posService.findAll(orgId, departmentId);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get position by id' })
  findOne(@Param('id') id: string) {
    return this.posService.findOne(id);
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create position (standalone mode)' })
  create(@Body() body: any) {
    return this.posService.create(body);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update position' })
  update(@Param('id') id: string, @Body() body: any) {
    return this.posService.update(id, body);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete position' })
  remove(@Param('id') id: string) {
    return this.posService.remove(id);
  }
}

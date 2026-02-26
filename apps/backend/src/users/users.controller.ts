import {
  Controller,
  Get,
  Param,
  Patch,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UsersService } from './users.service';
import { UserRole } from '@prisma/client';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'List all users' })
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  findById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id/role')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update user role' })
  updateRole(@Param('id') id: string, @Body('role') role: UserRole) {
    return this.usersService.updateRole(id, role);
  }

  @Patch(':id/manager')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Assign manager to user' })
  assignManager(
    @Param('id') id: string,
    @Body('managerId') managerId: string,
  ) {
    return this.usersService.assignManager(id, managerId);
  }
}

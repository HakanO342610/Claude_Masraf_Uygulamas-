import {
  Controller,
  Get,
  Param,
  Patch,
  Delete,
  Body,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
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
  findById(
    @Param('id') id: string,
    @CurrentUser('id') currentUserId: string,
    @CurrentUser('role') currentRole: string,
  ) {
    if (id !== currentUserId && !['ADMIN', 'MANAGER'].includes(currentRole)) {
      throw new ForbiddenException('Access denied');
    }
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

  @Patch(':id/approve')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Approve user account' })
  approveUser(@Param('id') id: string) {
    return this.usersService.approveUser(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update user info' })
  updateUser(
    @Param('id') id: string,
    @Body() body: { name?: string; email?: string; department?: string },
  ) {
    return this.usersService.updateUser(id, body);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete user' })
  deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(id);
  }

  @Patch('me/fcm-token')
  @ApiOperation({ summary: 'Register FCM push token for current user' })
  updateFcmToken(
    @CurrentUser('id') userId: string,
    @Body('fcmToken') fcmToken: string,
  ) {
    return this.usersService.updateFcmToken(userId, fcmToken);
  }

  @Get('admin/audit-logs')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List audit logs (admin only)' })
  findAuditLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
  ) {
    return this.usersService.findAuditLogs({
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      userId,
      action,
    });
  }
}

import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PolicyService } from './policy.service';
import { CreatePolicyRuleDto } from './dto/create-policy-rule.dto';

@ApiTags('Policy')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('policy')
export class PolicyController {
  constructor(private policyService: PolicyService) {}

  @Get()
  @Roles('ADMIN', 'FINANCE', 'MANAGER')
  @ApiOperation({ summary: 'List all policy rules' })
  findAll() {
    return this.policyService.findAll();
  }

  @Post()
  @Roles('ADMIN', 'FINANCE')
  @ApiOperation({ summary: 'Create a policy rule' })
  create(@Body() dto: CreatePolicyRuleDto) {
    return this.policyService.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'FINANCE')
  @ApiOperation({ summary: 'Update a policy rule' })
  update(@Param('id') id: string, @Body() dto: Partial<CreatePolicyRuleDto>) {
    return this.policyService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a policy rule' })
  remove(@Param('id') id: string) {
    return this.policyService.remove(id);
  }
}

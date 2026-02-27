import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateExpenseDto {
  @ApiProperty({ example: '2026-02-20' })
  @IsDateString()
  expenseDate: string;

  @ApiProperty({ example: 2450.5 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ example: 'TRY', required: false })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({ example: 250.0, required: false })
  @IsNumber()
  @IsOptional()
  taxAmount?: number;

  @ApiProperty({ example: 'Travel' })
  @IsString()
  category: string;

  @ApiProperty({ example: 'PRJ-10', required: false })
  @IsString()
  @IsOptional()
  projectCode?: string;

  @ApiProperty({ example: '100200', required: false })
  @IsString()
  @IsOptional()
  costCenter?: string;

  @ApiProperty({ example: 'Client visit to Istanbul', required: false })
  @IsString()
  @IsOptional()
  description?: string;
}

import { PartialType } from '@nestjs/swagger';

export class UpdateExpenseDto extends PartialType(CreateExpenseDto) {}

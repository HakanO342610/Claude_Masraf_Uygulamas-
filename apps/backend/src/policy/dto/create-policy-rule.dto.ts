import { IsString, IsNumber, IsOptional, IsBoolean, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePolicyRuleDto {
  @ApiProperty({ example: 'Yemek limiti aylık 5000 TRY' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'MEALS', description: 'Boş bırakılırsa tüm kategorilere uygulanır' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ example: 5000, description: 'Aylık maksimum harcama limiti' })
  @IsNumber()
  @Min(0)
  monthlyLimit: number;

  @ApiPropertyOptional({ example: 200, description: 'Bu tutarın üzerindeki masraflar için fiş zorunlu' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  requireReceiptAbove?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

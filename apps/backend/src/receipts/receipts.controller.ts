import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ReceiptsService } from './receipts.service';

const storage = diskStorage({
  destination: './uploads',
  filename: (_req, file, cb) => {
    const uniqueName = `${randomUUID()}${extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: any) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, JPG, PNG, WebP and PDF files are allowed'), false);
  }
};

@ApiTags('Receipts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('receipts')
export class ReceiptsController {
  constructor(private receiptsService: ReceiptsService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a receipt for OCR processing' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('id') userId: string,
  ) {
    return this.receiptsService.upload(file, userId);
  }

  @Patch(':id/attach-to-expense/:expenseId')
  @ApiOperation({ summary: 'Attach receipt to an expense' })
  attachToExpense(
    @Param('id') id: string,
    @Param('expenseId') expenseId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.receiptsService.attachToExpense(id, expenseId, userId);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get my uploaded receipts' })
  getMyReceipts(@CurrentUser('id') userId: string) {
    return this.receiptsService.getMyReceipts(userId);
  }

  @Get('expense/:expenseId')
  @ApiOperation({ summary: 'Get receipts for an expense' })
  getByExpense(
    @Param('expenseId') expenseId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    return this.receiptsService.getByExpense(expenseId, userId, userRole);
  }
}

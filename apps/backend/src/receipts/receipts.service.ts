import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as path from 'path';

import * as Tesseract from 'tesseract.js';

@Injectable()
export class ReceiptsService {
  private readonly logger = new Logger(ReceiptsService.name);

  constructor(private prisma: PrismaService) {}

  async upload(
    file: Express.Multer.File,
    userId: string,
  ) {
    if (!file) throw new BadRequestException('No file provided');

    const receipt = await this.prisma.receipt.create({
      data: {
        fileName: file.originalname,
        filePath: file.path,
        mimeType: file.mimetype,
        fileSize: file.size,
        uploadedBy: userId,
      },
    });

    // Trigger OCR processing
    const ocrData = await this.processOcr(receipt.id, file.path);

    return {
      id: receipt.id,
      fileName: receipt.fileName,
      ocrStatus: ocrData ? 'COMPLETED' : 'FAILED',
      ocrData,
    };
  }

  async attachToExpense(receiptId: string, expenseId: string, userId: string) {
    const receipt = await this.prisma.receipt.findUnique({
      where: { id: receiptId },
    });
    if (!receipt) throw new NotFoundException('Receipt not found');
    if (receipt.uploadedBy !== userId) {
      throw new BadRequestException('You can only attach your own receipts');
    }

    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
    });
    if (!expense) throw new NotFoundException('Expense not found');
    if (expense.userId !== userId) {
      throw new BadRequestException('You can only attach receipts to your own expenses');
    }

    const updated = await this.prisma.receipt.update({
      where: { id: receiptId },
      data: { expenseId },
    });

    // Update expense receiptUrl
    await this.prisma.expense.update({
      where: { id: expenseId },
      data: { receiptUrl: receipt.filePath },
    });

    return updated;
  }

  async getByExpense(expenseId: string) {
    return this.prisma.receipt.findMany({
      where: { expenseId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMyReceipts(userId: string) {
    return this.prisma.receipt.findMany({
      where: { uploadedBy: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  private async processOcr(
    receiptId: string,
    filePath: string,
  ): Promise<Record<string, any> | null> {
    try {
      await this.prisma.receipt.update({
        where: { id: receiptId },
        data: { ocrStatus: 'PROCESSING' },
      });

      const absolutePath = path.resolve(filePath);
      const worker = await Tesseract.createWorker('eng+tur');
      const ret = await worker.recognize(absolutePath);
      const text = ret.data.text;
      const confidence = ret.data.confidence;
      await worker.terminate();

      // Basic extraction logic
      let extractedAmount: number | null = null;
      let extractedDate: string | null = null;
      let extractedVendor: string | null = null;

      const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

      if (lines.length > 0) {
        // Assume first line is vendor
        extractedVendor = lines[0];
      }

      // Regex to find dates (dd.mm.yyyy, dd/mm/yyyy, dd-mm-yyyy)
      const dateRegex = /\b(\d{2})[\.\/\-](\d{2})[\.\/\-](\d{4})\b/;
      for (const line of lines) {
        const dateMatch = line.match(dateRegex);
        if (dateMatch) {
          // Format as yyyy-mm-dd
          extractedDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
          break;
        }
      }

      // Regex to find totals
      const totalRegex = /(?:TOPLAM|TOTAL|TUTAR)[^0-9]*([0-9]+[.,][0-9]{2})/i;
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        const match = line.match(totalRegex);
        if (match) {
          extractedAmount = parseFloat(match[1].replace(',', '.'));
          break;
        }
      }

      // If amount not found using keywords, just try to find the largest currency-like number near the bottom
      if (!extractedAmount) {
        // Try loose amount patterns: e.g. "12 50", "12,50", "12.50", "S0" (sometimes 5 becomes S)
        const amountRegex = /(\d+)[.,\s](\d{2})\b/;
        for (let i = lines.length - 1; i >= Math.max(0, lines.length - 8); i--) {
          const match = lines[i].match(amountRegex);
          if (match) {
            extractedAmount = parseFloat(`${match[1]}.${match[2]}`);
            break;
          }
        }
      }
      
      // Fallback: Just get the biggest number from the bottom 15 lines if all else fails
      if (!extractedAmount) {
        for (let i = lines.length - 1; i >= Math.max(0, lines.length - 15); i--) {
            const matches = lines[i].match(/\d+/g);
            if(matches && matches.length > 0) {
               const maxNum = Math.max(...matches.map(Number));
               if (maxNum > 0) {
                   extractedAmount = maxNum;
                   break;
               }
            }
        }
      }


      const ocrData = {
        extractedAmount,
        extractedDate,
        extractedVendor,
        extractedCategory: null as string | null,
        confidence,
        rawText: text,
      };

      await this.prisma.receipt.update({
        where: { id: receiptId },
        data: { ocrStatus: 'COMPLETED', ocrData: ocrData as any },
      });

      this.logger.log(`OCR completed for receipt ${receiptId} with actual Tesseract`);
      return ocrData;
    } catch (error) {
      await this.prisma.receipt.update({
        where: { id: receiptId },
        data: { ocrStatus: 'FAILED' },
      });
      this.logger.warn(`OCR failed for receipt ${receiptId}: ${(error as Error).message}`);
      return null;
    }
  }
}

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ExpenseStatus } from '@prisma/client';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class SapIntegrationService {
  private readonly logger = new Logger(SapIntegrationService.name);
  private sapClient: AxiosInstance;
  private readonly MAX_RETRIES = 3;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.sapClient = axios.create({
      baseURL: this.config.get('SAP_BASE_URL'),
      auth: {
        username: this.config.get('SAP_USERNAME') || '',
        password: this.config.get('SAP_PASSWORD') || '',
      },
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 30000,
    });
  }

  async postExpenseToSap(expenseId: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
      include: { user: true },
    });

    if (!expense) throw new NotFoundException('Expense not found');
    if (
      expense.status !== ExpenseStatus.MANAGER_APPROVED &&
      expense.status !== ExpenseStatus.FINANCE_APPROVED
    ) {
      throw new BadRequestException('Expense must be approved before posting to SAP');
    }

    const sapPayload = {
      CompanyCode: '1000',
      DocumentDate: expense.expenseDate.toISOString().split('T')[0],
      PostingDate: new Date().toISOString().split('T')[0],
      DocumentType: 'KR',
      Currency: expense.currency,
      Reference: `EXP-${expense.id.slice(0, 8).toUpperCase()}`,
      LineItems: [
        {
          GLAccount: this.mapCategoryToGLAccount(expense.category),
          Amount: Number(expense.amount),
          CostCenter: expense.costCenter || '100000',
          TaxCode: 'V1',
          Text: expense.description || '',
        },
      ],
    };

    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        this.logger.log(`SAP posting attempt ${attempt} for expense ${expenseId}`);
        const response = await this.sapClient.post(
          '/API_JOURNALENTRY_POST/JournalEntryPost',
          sapPayload,
        );

        const sapDocNumber = response.data?.sapDocumentNumber || response.data?.d?.DocumentNumber || `SIM-${Date.now()}`;

        await this.prisma.expense.update({
          where: { id: expenseId },
          data: {
            status: ExpenseStatus.POSTED_TO_SAP,
            sapDocumentNumber: sapDocNumber,
          },
        });

        await this.prisma.auditLog.create({
          data: {
            userId: expense.userId,
            expenseId,
            action: 'POSTED_TO_SAP',
            details: `SAP Document: ${sapDocNumber}`,
          },
        });

        return {
          sapDocumentNumber: sapDocNumber,
          status: 'Posted',
          expenseId,
        };
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `SAP posting attempt ${attempt} failed: ${(error as Error).message}`,
        );
        if (attempt < this.MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
      }
    }

    this.logger.error(`SAP posting failed after ${this.MAX_RETRIES} attempts`);
    await this.prisma.auditLog.create({
      data: {
        userId: expense.userId,
        expenseId,
        action: 'SAP_POST_FAILED',
        details: lastError?.message || 'Unknown error',
      },
    });

    throw new BadRequestException(
      `Failed to post to SAP after ${this.MAX_RETRIES} attempts: ${lastError?.message}`,
    );
  }

  private mapCategoryToGLAccount(category: string): string {
    const mapping: Record<string, string> = {
      Travel: '770001',
      Accommodation: '770002',
      Meals: '770003',
      Transportation: '770004',
      Office: '770005',
      Other: '770099',
    };
    return mapping[category] || '770099';
  }
}

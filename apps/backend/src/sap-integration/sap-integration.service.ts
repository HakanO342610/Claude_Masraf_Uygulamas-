import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ExpenseStatus } from '@prisma/client';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';

@Injectable()
export class SapIntegrationService {
  private readonly logger = new Logger(SapIntegrationService.name);
  private sapClient: AxiosInstance;
  private readonly MAX_RETRIES = 3;
  private readonly DEFAULT_TAX_RATE = 0.18;
  private readonly TAX_GL_ACCOUNT = '191000';

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

    // Idempotency: prevent double posting
    if (expense.status === ExpenseStatus.POSTED_TO_SAP) {
      throw new ConflictException(
        `Expense already posted to SAP: ${expense.sapDocumentNumber}`,
      );
    }

    if (
      expense.status !== ExpenseStatus.MANAGER_APPROVED &&
      expense.status !== ExpenseStatus.FINANCE_APPROVED
    ) {
      throw new BadRequestException(
        'Expense must be approved before posting to SAP',
      );
    }

    const sapPayload = this.buildSapPayload(expense);

    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        this.logger.log(
          `SAP posting attempt ${attempt} for expense ${expenseId}`,
        );
        const response = await this.sapClient.post(
          '/API_JOURNALENTRY_POST/JournalEntryPost',
          sapPayload,
        );

        const sapDocNumber =
          response.data?.sapDocumentNumber ||
          response.data?.d?.DocumentNumber ||
          `SIM-${Date.now()}`;

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

    this.logger.error(
      `SAP posting failed after ${this.MAX_RETRIES} attempts`,
    );
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

  buildSapPayload(expense: {
    id: string;
    expenseDate: Date;
    amount: any;
    taxAmount: any;
    currency: string;
    category: string;
    costCenter: string | null;
    description: string | null;
    updatedAt: Date;
    user: { sapEmployeeId: string | null };
  }) {
    const grossAmount = Number(expense.amount);
    const taxAmount = expense.taxAmount
      ? Number(expense.taxAmount)
      : +(grossAmount * this.DEFAULT_TAX_RATE).toFixed(2);
    const netAmount = +(grossAmount - taxAmount).toFixed(2);

    const idempotencyKey = crypto
      .createHash('sha256')
      .update(expense.id + expense.updatedAt.toISOString())
      .digest('hex');

    return {
      header: {
        companyCode: '1000',
        documentDate: expense.expenseDate.toISOString().split('T')[0],
        postingDate: new Date().toISOString().split('T')[0],
        documentType: 'KR',
        reference: `EXP-${expense.id.slice(0, 8).toUpperCase()}`,
        headerText: `Employee ${expense.category} Expense`,
        currency: expense.currency,
        idempotencyKey,
      },
      items: [
        {
          type: 'GL',
          glAccount: this.mapCategoryToGLAccount(expense.category),
          amount: netAmount,
          debitCredit: 'D',
          costCenter: expense.costCenter || '100000',
          taxCode: 'V1',
        },
        {
          type: 'TAX',
          glAccount: this.TAX_GL_ACCOUNT,
          amount: taxAmount,
          debitCredit: 'D',
          taxCode: 'V1',
        },
        {
          type: 'VENDOR',
          vendor: expense.user.sapEmployeeId || '100000',
          amount: grossAmount,
          debitCredit: 'C',
        },
      ],
    };
  }

  mapCategoryToGLAccount(category: string): string {
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

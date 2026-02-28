import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ExpenseStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { SapAdapterFactory } from './adapters/sap-adapter.factory';
import { ISapAdapter, SapExpensePayload } from './adapters/sap-adapter.interface';

@Injectable()
export class SapIntegrationService implements OnModuleInit {
  private readonly logger = new Logger(SapIntegrationService.name);
  private readonly MAX_RETRIES = 3;
  private readonly DEFAULT_TAX_RATE = 0.18;
  private adapter: ISapAdapter;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private adapterFactory: SapAdapterFactory,
  ) {}

  onModuleInit() {
    this.adapter = this.adapterFactory.create();
    this.logger.log(`SAP adapter ready — type: ${this.adapterFactory.getSapType()}`);
  }

  // ─── Test Connection ──────────────────────────────────────────────────────

  async testConnection() {
    return this.adapter.testConnection();
  }

  // ─── Post Expense ─────────────────────────────────────────────────────────

  async postExpenseToSap(expenseId: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
      include: { user: true },
    });

    if (!expense) throw new NotFoundException('Expense not found');

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

    const grossAmount = Number(expense.amount);
    const taxAmount = expense.taxAmount
      ? Number(expense.taxAmount)
      : +(grossAmount * this.DEFAULT_TAX_RATE).toFixed(2);

    const payload: SapExpensePayload = {
      id: expense.id,
      expenseDate: expense.expenseDate,
      amount: grossAmount,
      taxAmount,
      currency: expense.currency,
      category: expense.category,
      costCenter: expense.costCenter,
      projectCode: expense.projectCode,
      description: expense.description,
      reference: `EXP-${expense.id.slice(0, 8).toUpperCase()}`,
      user: {
        sapEmployeeId: expense.user.sapEmployeeId,
        name: expense.user.name,
        department: expense.user.department,
      },
    };

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        this.logger.log(`SAP posting attempt ${attempt} for expense ${expenseId}`);

        const result = await this.adapter.postExpense(payload);

        await this.prisma.expense.update({
          where: { id: expenseId },
          data: {
            status: ExpenseStatus.POSTED_TO_SAP,
            sapDocumentNumber: result.sapDocumentNumber,
          },
        });

        await this.prisma.auditLog.create({
          data: {
            userId: expense.userId,
            expenseId,
            action: 'POSTED_TO_SAP',
            details: `SAP Document: ${result.sapDocumentNumber} | Type: ${this.adapterFactory.getSapType()}`,
          },
        });

        return {
          sapDocumentNumber: result.sapDocumentNumber,
          status: result.status,
          sapType: this.adapterFactory.getSapType(),
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

  // Kept for backward compatibility with queue service
  buildSapPayload(expense: any) {
    const idempotencyKey = crypto
      .createHash('sha256')
      .update(expense.id + (expense.updatedAt?.toISOString() || ''))
      .digest('hex');
    return { idempotencyKey, expenseId: expense.id };
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

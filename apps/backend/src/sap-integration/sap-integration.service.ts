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

    // sapDocumentNumber zaten varsa (ama status güncellenmemişse) tekrar gönderme
    if (expense.sapDocumentNumber) {
      this.logger.warn(
        `Expense ${expenseId} already has sapDocumentNumber=${expense.sapDocumentNumber}, fixing status...`,
      );
      // Status'u düzelt ve hata fırlat
      await this.prisma.expense.update({
        where: { id: expenseId },
        data: { status: ExpenseStatus.POSTED_TO_SAP },
      });
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
      receiptNumber: (expense as any).receiptNumber || null,
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
        // Tekrar denemeden önce DB'den expense'i kontrol et — arada başarılı olmuş olabilir
        if (attempt > 1) {
          const freshExpense = await this.prisma.expense.findUnique({ where: { id: expenseId } });
          if (freshExpense?.status === ExpenseStatus.POSTED_TO_SAP || freshExpense?.sapDocumentNumber) {
            this.logger.warn(`Expense ${expenseId} already posted (attempt ${attempt} cancelled)`);
            return {
              sapDocumentNumber: freshExpense.sapDocumentNumber || 'ALREADY_POSTED',
              status: 'Already Posted',
              sapType: this.adapterFactory.getSapType(),
              expenseId,
            };
          }
        }

        this.logger.log(`SAP posting attempt ${attempt} for expense ${expenseId}`);

        // Retry attempt bilgisini payload'a ekle — SAP tarafında tekrar log yazmasını engeller
        (payload as any).retryAttempt = attempt;

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
            details: [
              `SAP Belge No: ${result.sapDocumentNumber}`,
              result.fiscalYear ? `Mali Yıl: ${result.fiscalYear}` : null,
              `SAP Türü: ${this.adapterFactory.getSapType()}`,
              `Deneme: ${attempt}/${this.MAX_RETRIES}`,
              `Tutar: ${expense.amount} ${expense.currency}`,
              `Fiş No: ${(expense as any).receiptNumber || '-'}`,
              `Çalışan: ${expense.user.name}`,
            ].filter(Boolean).join(' | '),
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
        details: [
          `${this.MAX_RETRIES} denemeden sonra başarısız`,
          `Hata: ${lastError?.message || 'Bilinmeyen hata'}`,
          `SAP Türü: ${this.adapterFactory.getSapType()}`,
          `Tutar: ${expense.amount} ${expense.currency}`,
          `Fiş No: ${(expense as any).receiptNumber || '-'}`,
          `Çalışan: ${expense.user.name}`,
          `Zaman: ${new Date().toISOString()}`,
        ].join(' | '),
      },
    });

    throw new BadRequestException(
      `Failed to post to SAP after ${this.MAX_RETRIES} attempts: ${lastError?.message}`,
    );
  }

  // ─── Debug: SAP raw response (DB'ye hiçbir şey yazmaz) ───────────────────
  // ABAP debug modunda iken bu endpoint'i çağır — tam ham yanıt döner.

  async debugRawPost(expenseId: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
      include: { user: true },
    });
    if (!expense) throw new NotFoundException('Expense not found');

    const grossAmount = Number(expense.amount);
    const taxAmount   = expense.taxAmount
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
      receiptNumber: (expense as any).receiptNumber || null,
      reference: `EXP-${expense.id.slice(0, 8).toUpperCase()}`,
      user: {
        sapEmployeeId: expense.user.sapEmployeeId,
        name: expense.user.name,
        department: expense.user.department,
      },
    };

    // Debug modunda SAP'ın log yazmamasını ve BAPI commit yapmamasını sağla
    (payload as any).debugMode = true;

    this.logger.log(`[DEBUG] Payload gönderiliyor: ${JSON.stringify(payload)}`);

    let result: any;
    let errorDetail: any;

    try {
      result = await this.adapter.postExpense(payload);
    } catch (err: any) {
      errorDetail = {
        message: err.message,
        stack: err.stack?.split('\n').slice(0, 5).join('\n'),
      };
    }

    return {
      expenseId,
      receiptNumber: (expense as any).receiptNumber,
      payload,
      sapResult: result ?? null,
      sapError: errorDetail ?? null,
      dbNotUpdated: true,
    };
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

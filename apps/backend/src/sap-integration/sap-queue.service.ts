import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SapIntegrationService } from './sap-integration.service';
import { ExpenseStatus } from '@prisma/client';

@Injectable()
export class SapQueueService {
  private readonly logger = new Logger(SapQueueService.name);
  private readonly MAX_ATTEMPTS = 5;
  private processing = false;

  constructor(
    private prisma: PrismaService,
    private sapService: SapIntegrationService,
  ) {}

  // ─── Kuyruğa Ekle ──────────────────────────────────────────────────────
  // Mükerrer koruma: aynı expense için PENDING/PROCESSING kayıt varsa tekrar ekleme
  async enqueue(expenseId: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
      include: { user: true },
    });
    if (!expense) return;

    // Zaten SAP'a gönderilmişse kuyruğa ekleme
    if (expense.status === ExpenseStatus.POSTED_TO_SAP || expense.sapDocumentNumber) {
      this.logger.warn(`Expense ${expenseId} already posted to SAP, skipping enqueue`);
      return;
    }

    // Mükerrer koruma
    const existing = await this.prisma.sapPostingQueue.findFirst({
      where: {
        expenseId,
        status: { in: ['PENDING', 'PROCESSING'] },
      },
    });
    if (existing) {
      this.logger.warn(`Expense ${expenseId} already in queue (${existing.id}), skipping`);
      return;
    }

    const payload = this.sapService.buildSapPayload(expense);

    const queueItem = await this.prisma.sapPostingQueue.create({
      data: {
        expenseId,
        payload: payload as any,
      },
    });

    this.logger.log(`Enqueued SAP posting for expense ${expenseId} → queue item ${queueItem.id}`);

    // İlk denemeyi hemen yap (bekletme)
    this.processItemById(queueItem.id).catch((err) => {
      this.logger.warn(`Immediate process failed for ${queueItem.id}: ${err.message}`);
    });
  }

  // ─── Cron: Her 1 dakikada bekleyen öğeleri işle ──────────────────────
  @Cron('*/1 * * * *')
  async processQueue() {
    if (this.processing) return;
    this.processing = true;

    try {
      const now = new Date();
      const pendingItems = await this.prisma.sapPostingQueue.findMany({
        where: {
          status: { in: ['PENDING', 'FAILED'] },
          attempts: { lt: this.MAX_ATTEMPTS },
          OR: [
            { nextRetry: null },
            { nextRetry: { lte: now } },
          ],
        },
        include: { expense: { include: { user: true } } },
        take: 10,
        orderBy: { createdAt: 'asc' },
      });

      for (const item of pendingItems) {
        await this.processItem(item);
      }

      if (pendingItems.length > 0) {
        this.logger.log(`Processed ${pendingItems.length} queue item(s)`);
      }
    } finally {
      this.processing = false;
    }
  }

  // ─── Tek öğe işle (ID ile — enqueue sonrası immediate) ────────────────
  private async processItemById(queueId: string) {
    const item = await this.prisma.sapPostingQueue.findUnique({
      where: { id: queueId },
      include: { expense: { include: { user: true } } },
    });
    if (!item) return;
    await this.processItem(item);
  }

  // ─── Kuyruk öğesini işle ──────────────────────────────────────────────
  private async processItem(item: {
    id: string;
    expenseId: string;
    attempts: number;
    expense: { id: string; userId: string; status: string; sapDocumentNumber?: string | null };
  }) {
    // Zaten SAP'ta ise atla
    if (
      item.expense.status === ExpenseStatus.POSTED_TO_SAP ||
      item.expense.sapDocumentNumber
    ) {
      await this.prisma.sapPostingQueue.update({
        where: { id: item.id },
        data: { status: 'COMPLETED' },
      });
      this.logger.log(`Queue item ${item.id}: expense already posted, marking completed`);
      return;
    }

    await this.prisma.sapPostingQueue.update({
      where: { id: item.id },
      data: { status: 'PROCESSING' },
    });

    try {
      const result = await this.sapService.postExpenseToSap(item.expenseId);

      await this.prisma.sapPostingQueue.update({
        where: { id: item.id },
        data: {
          status: 'COMPLETED',
          attempts: item.attempts + 1,
          lastError: null,
        },
      });

      this.logger.log(
        `Queue item ${item.id}: SAP posting success — doc ${result.sapDocumentNumber}`,
      );
    } catch (error) {
      const newAttempts = item.attempts + 1;
      const isFinalAttempt = newAttempts >= this.MAX_ATTEMPTS;

      // Exponential backoff: 1min, 2min, 4min, 8min, 16min
      const nextRetry = new Date();
      nextRetry.setMinutes(nextRetry.getMinutes() + Math.pow(2, newAttempts));

      const newStatus = isFinalAttempt ? 'DEAD_LETTER' : 'FAILED';

      await this.prisma.sapPostingQueue.update({
        where: { id: item.id },
        data: {
          status: newStatus,
          attempts: newAttempts,
          lastError: (error as Error).message,
          nextRetry: isFinalAttempt ? null : nextRetry,
        },
      });

      if (isFinalAttempt) {
        await this.prisma.auditLog.create({
          data: {
            userId: item.expense.userId,
            expenseId: item.expenseId,
            action: 'SAP_QUEUE_DEAD_LETTER',
            details: `${this.MAX_ATTEMPTS} denemeden sonra başarısız. Hata: ${(error as Error).message}`,
          },
        });
        this.logger.error(
          `Queue item ${item.id}: DEAD LETTER after ${this.MAX_ATTEMPTS} attempts`,
        );
      } else {
        this.logger.warn(
          `Queue item ${item.id}: attempt ${newAttempts} failed, next retry: ${nextRetry.toISOString()}`,
        );
      }
    }
  }

  // ─── Manuel retry (kuyruk sayfasından) ────────────────────────────────
  // attempts sıfırlanmaz — manuel retry tek seferlik bir denemedir.
  // Başarısız olursa MAX_ATTEMPTS'e ulaşıldığı için DEAD_LETTER'a düşer,
  // cron bir daha otomatik olarak tetiklemez.
  async retryItem(queueId: string) {
    const item = await this.prisma.sapPostingQueue.findUnique({
      where: { id: queueId },
    });

    if (!item) return null;

    // attempts'i MAX_ATTEMPTS-1'e çek: bu deneme de başarısız olursa
    // newAttempts = MAX_ATTEMPTS → isFinalAttempt = true → DEAD_LETTER
    // cron bir daha bu öğeyi otomatik olarak almaz.
    await this.prisma.sapPostingQueue.update({
      where: { id: queueId },
      data: {
        status: 'PENDING',
        attempts: this.MAX_ATTEMPTS - 1,
        lastError: null,
        nextRetry: null,
      },
    });

    // Hemen işle (cron bekleme)
    this.processItemById(queueId).catch((err) => {
      this.logger.warn(`Manual retry failed for ${queueId}: ${err.message}`);
    });

    return { message: 'Kuyruk öğesi manuel olarak bir kez deneniyor', queueId };
  }

  // ─── Kuyruk durumu (frontend uyumlu format) ───────────────────────────
  async getQueueStatus() {
    const [pending, processing, completed, failed, deadLetter] = await Promise.all([
      this.prisma.sapPostingQueue.count({ where: { status: 'PENDING' } }),
      this.prisma.sapPostingQueue.count({ where: { status: 'PROCESSING' } }),
      this.prisma.sapPostingQueue.count({ where: { status: 'COMPLETED' } }),
      this.prisma.sapPostingQueue.count({ where: { status: 'FAILED' } }),
      this.prisma.sapPostingQueue.count({ where: { status: 'DEAD_LETTER' } }),
    ]);

    const items = await this.prisma.sapPostingQueue.findMany({
      where: { status: { not: 'COMPLETED' } },
      include: {
        expense: {
          select: {
            id: true,
            description: true,
            amount: true,
            currency: true,
            category: true,
            receiptNumber: true,
            user: { select: { name: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    return { pending, processing, completed, failed, deadLetter, items };
  }
}

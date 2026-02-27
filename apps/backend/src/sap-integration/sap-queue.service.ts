import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SapIntegrationService } from './sap-integration.service';
import { ExpenseStatus } from '@prisma/client';

@Injectable()
export class SapQueueService {
  private readonly logger = new Logger(SapQueueService.name);
  private readonly MAX_ATTEMPTS = 3;
  private processing = false;

  constructor(
    private prisma: PrismaService,
    private sapService: SapIntegrationService,
  ) {}

  async enqueue(expenseId: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
      include: { user: true },
    });

    if (!expense) return;

    const payload = this.sapService.buildSapPayload(expense);

    await this.prisma.sapPostingQueue.create({
      data: {
        expenseId,
        payload: payload as any,
      },
    });

    this.logger.log(`Enqueued SAP posting for expense ${expenseId}`);
  }

  @Cron('*/5 * * * *') // Every 5 minutes
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

  private async processItem(item: {
    id: string;
    expenseId: string;
    attempts: number;
    expense: { id: string; userId: string; status: string };
  }) {
    await this.prisma.sapPostingQueue.update({
      where: { id: item.id },
      data: { status: 'PROCESSING' },
    });

    try {
      await this.sapService.postExpenseToSap(item.expenseId);

      await this.prisma.sapPostingQueue.update({
        where: { id: item.id },
        data: { status: 'COMPLETED', attempts: item.attempts + 1 },
      });
    } catch (error) {
      const newAttempts = item.attempts + 1;
      const isFinalAttempt = newAttempts >= this.MAX_ATTEMPTS;

      // Exponential backoff: 5min, 25min, 125min
      const nextRetry = new Date();
      nextRetry.setMinutes(nextRetry.getMinutes() + Math.pow(5, newAttempts));

      await this.prisma.sapPostingQueue.update({
        where: { id: item.id },
        data: {
          status: isFinalAttempt ? 'FAILED' : 'PENDING',
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
            action: 'SAP_QUEUE_FAILED',
            details: `Failed after ${this.MAX_ATTEMPTS} attempts: ${(error as Error).message}`,
          },
        });
        this.logger.error(
          `SAP queue item ${item.id} permanently failed after ${this.MAX_ATTEMPTS} attempts`,
        );
      }
    }
  }

  async retryItem(queueId: string) {
    const item = await this.prisma.sapPostingQueue.findUnique({
      where: { id: queueId },
    });

    if (!item) return null;

    await this.prisma.sapPostingQueue.update({
      where: { id: queueId },
      data: {
        status: 'PENDING',
        attempts: 0,
        lastError: null,
        nextRetry: null,
      },
    });

    return { message: 'Item queued for retry', queueId };
  }

  async getQueueStatus() {
    const [pending, processing, completed, failed] = await Promise.all([
      this.prisma.sapPostingQueue.count({ where: { status: 'PENDING' } }),
      this.prisma.sapPostingQueue.count({ where: { status: 'PROCESSING' } }),
      this.prisma.sapPostingQueue.count({ where: { status: 'COMPLETED' } }),
      this.prisma.sapPostingQueue.count({ where: { status: 'FAILED' } }),
    ]);

    const failedItems = await this.prisma.sapPostingQueue.findMany({
      where: { status: 'FAILED' },
      include: { expense: { select: { id: true, description: true, amount: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    return { counts: { pending, processing, completed, failed }, failedItems };
  }
}

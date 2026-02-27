import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly ESCALATION_HOURS = 48;

  constructor(private prisma: PrismaService) {}

  @Cron('0 * * * *') // Every hour
  async checkPendingApprovals() {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - this.ESCALATION_HOURS);

    const staleApprovals = await this.prisma.approval.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: cutoff },
      },
      include: {
        approver: { select: { id: true, name: true, managerId: true } },
        expense: { select: { id: true, userId: true } },
      },
    });

    for (const approval of staleApprovals) {
      await this.escalateApproval(approval);
    }

    if (staleApprovals.length > 0) {
      this.logger.log(`Escalated ${staleApprovals.length} stale approval(s)`);
    }
  }

  private async escalateApproval(approval: {
    id: string;
    approver: { id: string; name: string; managerId: string | null };
    expense: { id: string; userId: string };
  }) {
    const { approver, expense } = approval;

    // Find the approver's manager for escalation
    if (!approver.managerId) {
      this.logger.warn(
        `Cannot escalate approval ${approval.id}: approver ${approver.name} has no manager`,
      );
      return;
    }

    // Check if an escalation approval already exists for this expense + manager
    const existingEscalation = await this.prisma.approval.findFirst({
      where: {
        expenseId: expense.id,
        approverId: approver.managerId,
        status: 'PENDING',
      },
    });

    if (existingEscalation) return;

    await this.prisma.approval.create({
      data: {
        expenseId: expense.id,
        approverId: approver.managerId,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: expense.userId,
        expenseId: expense.id,
        action: 'ESCALATED',
        details: `Escalated from ${approver.name} due to ${this.ESCALATION_HOURS}h timeout`,
      },
    });

    this.logger.log(
      `Escalated expense ${expense.id} from ${approver.name} to manager ${approver.managerId}`,
    );
  }
}

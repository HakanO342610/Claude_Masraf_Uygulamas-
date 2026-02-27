import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/create-expense.dto';
import { ExpenseStatus } from '@prisma/client';

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateExpenseDto) {
    return this.prisma.expense.create({
      data: {
        userId,
        expenseDate: new Date(dto.expenseDate),
        amount: dto.amount,
        currency: dto.currency || 'TRY',
        taxAmount: dto.taxAmount,
        category: dto.category,
        projectCode: dto.projectCode,
        costCenter: dto.costCenter,
        description: dto.description,
      },
      include: { user: { select: { name: true, email: true } } },
    });
  }

  async findAll(userId: string, query: { status?: string; fromDate?: string; toDate?: string }) {
    const where: any = { userId };
    if (query.status) where.status = query.status as ExpenseStatus;
    if (query.fromDate || query.toDate) {
      where.expenseDate = {};
      if (query.fromDate) where.expenseDate.gte = new Date(query.fromDate);
      if (query.toDate) where.expenseDate.lte = new Date(query.toDate);
    }

    return this.prisma.expense.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        approvals: {
          include: { approver: { select: { name: true } } },
        },
      },
    });
  }

  async findById(id: string, userId: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, email: true, department: true } },
        approvals: {
          include: { approver: { select: { name: true, email: true } } },
        },
      },
    });
    if (!expense) throw new NotFoundException('Expense not found');

    if (expense.userId !== userId) {
      const hasApproval = expense.approvals.some(
        (a) => a.approverId === userId,
      );
      if (!hasApproval) throw new ForbiddenException('Access denied');
    }

    return expense;
  }

  async update(id: string, userId: string, dto: UpdateExpenseDto) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');
    if (expense.userId !== userId) throw new ForbiddenException();
    if (expense.status === ExpenseStatus.FINANCE_APPROVED || expense.status === ExpenseStatus.POSTED_TO_SAP) {
      throw new BadRequestException('Approved expenses cannot be edited');
    }

    return this.prisma.expense.update({
      where: { id },
      data: dto,
    });
  }

  async delete(id: string, userId: string) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');
    if (expense.userId !== userId) throw new ForbiddenException();
    if (expense.status === ExpenseStatus.FINANCE_APPROVED || expense.status === ExpenseStatus.POSTED_TO_SAP) {
      throw new BadRequestException('Approved expenses cannot be deleted');
    }

    return this.prisma.expense.delete({ where: { id } });
  }

  async submit(id: string, userId: string) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');
    if (expense.userId !== userId) throw new ForbiddenException();
    if (expense.status === ExpenseStatus.FINANCE_APPROVED || expense.status === ExpenseStatus.POSTED_TO_SAP) {
      throw new BadRequestException('Approved expenses cannot be submitted');
    }

    if (expense.status === ExpenseStatus.SUBMITTED || expense.status === ExpenseStatus.MANAGER_APPROVED) {
      // Zaten onaya gönderilmişse tekrar onay akışı başlatmaya gerek yok.
      // Düzenleme işlemi (update) yeterli.
      return expense;
    }

    // Find manager
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { managerId: true },
    });

    const updated = await this.prisma.expense.update({
      where: { id },
      data: { status: ExpenseStatus.SUBMITTED },
    });

    // Create approval request for manager
    if (user?.managerId) {
      await this.prisma.approval.create({
        data: {
          expenseId: id,
          approverId: user.managerId,
        },
      });
    }

    await this.createAuditLog(userId, id, 'SUBMITTED', 'Expense submitted for approval');

    return updated;
  }

  async approve(id: string, approverId: string, comment?: string) {
    const approval = await this.prisma.approval.findFirst({
      where: { expenseId: id, approverId, status: 'PENDING' },
    });
    if (!approval) throw new NotFoundException('No pending approval found');

    const approver = await this.prisma.user.findUnique({
      where: { id: approverId },
    });

    let newStatus: ExpenseStatus;
    if (approver?.role === 'MANAGER') {
      newStatus = ExpenseStatus.MANAGER_APPROVED;
    } else if (approver?.role === 'FINANCE') {
      newStatus = ExpenseStatus.FINANCE_APPROVED;
    } else {
      newStatus = ExpenseStatus.MANAGER_APPROVED;
    }

    await this.prisma.approval.update({
      where: { id: approval.id },
      data: { status: 'APPROVED', comment, actionDate: new Date() },
    });

    const updated = await this.prisma.expense.update({
      where: { id },
      data: { status: newStatus },
    });

    await this.createAuditLog(approverId, id, 'APPROVED', comment || 'Expense approved');

    // Auto-escalate to Finance after Manager approval
    if (newStatus === ExpenseStatus.MANAGER_APPROVED) {
      const financeUser = await this.prisma.user.findFirst({
        where: { role: 'FINANCE' },
      });

      if (financeUser) {
        await this.prisma.approval.create({
          data: {
            expenseId: id,
            approverId: financeUser.id,
          },
        });
        await this.createAuditLog(
          approverId,
          id,
          'ESCALATED_TO_FINANCE',
          `Auto-escalated to Finance user: ${financeUser.name}`,
        );
      } else {
        // No Finance user exists — auto-approve as Finance
        await this.prisma.expense.update({
          where: { id },
          data: { status: ExpenseStatus.FINANCE_APPROVED },
        });
        await this.createAuditLog(
          approverId,
          id,
          'AUTO_FINANCE_APPROVED',
          'No Finance user found, auto-approved',
        );
      }
    }

    return updated;
  }

  async reject(id: string, approverId: string, comment: string) {
    const approval = await this.prisma.approval.findFirst({
      where: { expenseId: id, approverId, status: 'PENDING' },
    });
    if (!approval) throw new NotFoundException('No pending approval found');

    await this.prisma.approval.update({
      where: { id: approval.id },
      data: { status: 'REJECTED', comment, actionDate: new Date() },
    });

    const updated = await this.prisma.expense.update({
      where: { id },
      data: { status: ExpenseStatus.REJECTED },
    });

    await this.createAuditLog(approverId, id, 'REJECTED', comment);

    return updated;
  }

  async getPendingApprovals(approverId: string) {
    return this.prisma.approval.findMany({
      where: { approverId, status: 'PENDING' },
      include: {
        expense: {
          include: { user: { select: { name: true, email: true, department: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async createAuditLog(
    userId: string,
    expenseId: string,
    action: string,
    details: string,
  ) {
    await this.prisma.auditLog.create({
      data: { userId, expenseId, action, details },
    });
  }
}

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { PolicyService } from '../policy/policy.service';
import { SapIntegrationService } from '../sap-integration/sap-integration.service';
import { SapQueueService } from '../sap-integration/sap-queue.service';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/create-expense.dto';
import { ExpenseStatus } from '@prisma/client';

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    private prisma: PrismaService,
    private push: PushService,
    private policy: PolicyService,
    private sapService: SapIntegrationService,
    private sapQueue: SapQueueService,
  ) {}

  async create(userId: string, dto: CreateExpenseDto) {
    // --- Fiş/Fatura no mükerrer kontrolü (zorunlu alan) ---
    const existing = await this.prisma.expense.findUnique({
      where: { receiptNumber: dto.receiptNumber },
    });
    if (existing) {
      throw new BadRequestException(
        `Bu fiş/fatura numarası (${dto.receiptNumber}) ile zaten bir masraf kaydı mevcut. Mükerrer giriş yapılamaz.`,
      );
    }

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
        receiptNumber: dto.receiptNumber,
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

  // ─── FINANCE / ADMIN: Tüm masrafları SAP durum bilgisiyle listele ──────
  async findAllAdmin(query: { status?: string; fromDate?: string; toDate?: string }) {
    const where: any = {};
    if (query.status) where.status = query.status as ExpenseStatus;
    if (query.fromDate || query.toDate) {
      where.expenseDate = {};
      if (query.fromDate) where.expenseDate.gte = new Date(query.fromDate);
      if (query.toDate) where.expenseDate.lte = new Date(query.toDate);
    }

    const expenses = await this.prisma.expense.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true, department: true } },
        approvals: {
          include: { approver: { select: { name: true } } },
        },
      },
    });

    // SAP durumu batch hesapla — N+1 sorgusu yerine tek sorguda
    const expenseIds = expenses.map((e) => e.id);
    const sapFailLogs = await this.prisma.auditLog.findMany({
      where: { expenseId: { in: expenseIds }, action: 'SAP_POST_FAILED' },
      orderBy: { createdAt: 'desc' },
    });
    const sapSuccessLogs = await this.prisma.auditLog.findMany({
      where: { expenseId: { in: expenseIds }, action: 'POSTED_TO_SAP' },
      orderBy: { createdAt: 'desc' },
    });
    const failMap = new Map(sapFailLogs.map((l) => [l.expenseId, l.details]));
    const successMap = new Map(sapSuccessLogs.map((l) => [l.expenseId, l.details]));

    return expenses.map((e) => {
      let sapStatus: string;
      if (e.status === ExpenseStatus.POSTED_TO_SAP) {
        // SAP-OK- prefix: fallback doc number — SAP may not have a real FI document
        sapStatus = e.sapDocumentNumber?.startsWith('SAP-OK-') ? 'FALLBACK' : 'OK';
      } else if (
        (e.status === ExpenseStatus.FINANCE_APPROVED ||
         e.status === ExpenseStatus.MANAGER_APPROVED) &&
        failMap.has(e.id)
      ) {
        sapStatus = 'FAILED';
      } else if (e.status === ExpenseStatus.FINANCE_APPROVED && !e.sapDocumentNumber) {
        sapStatus = 'PENDING';
      } else {
        sapStatus = 'NOT_APPLICABLE';
      }
      return {
        ...e,
        sapStatus,
        sapPostError: failMap.get(e.id) || null,
        sapPostSuccess: successMap.get(e.id) || null,
      };
    });
  }

  // ─── Fiş/Fatura No ile arama (Swagger debug için) ────────────────────────
  async findByReceiptNumber(receiptNumber: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { receiptNumber },
      include: {
        user: { select: { name: true, email: true, department: true } },
        approvals: {
          include: { approver: { select: { name: true, email: true } } },
        },
      },
    });
    if (!expense) throw new NotFoundException(`receiptNumber=${receiptNumber} ile masraf bulunamadı`);

    const sapFailLog = await this.prisma.auditLog.findFirst({
      where: { expenseId: expense.id, action: 'SAP_POST_FAILED' },
      orderBy: { createdAt: 'desc' },
    });
    const sapSuccessLog = await this.prisma.auditLog.findFirst({
      where: { expenseId: expense.id, action: 'POSTED_TO_SAP' },
      orderBy: { createdAt: 'desc' },
    });

    let sapStatus: string;
    if (expense.status === ExpenseStatus.POSTED_TO_SAP)
      sapStatus = expense.sapDocumentNumber?.startsWith('SAP-OK-') ? 'FALLBACK' : 'OK';
    else if (sapFailLog) sapStatus = 'FAILED';
    else if (expense.status === ExpenseStatus.FINANCE_APPROVED) sapStatus = 'PENDING';
    else sapStatus = 'NOT_APPLICABLE';

    return {
      ...expense,
      sapStatus,
      sapPostError: sapFailLog?.details || null,
      sapPostSuccess: sapSuccessLog?.details || null,
    };
  }

  async findById(id: string, userId: string, userRole?: string) {
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

    // ADMIN, FINANCE, MANAGER her masrafı görebilir
    const elevatedRoles = ['ADMIN', 'FINANCE', 'MANAGER'];
    if (expense.userId !== userId && !elevatedRoles.includes(userRole || '')) {
      const hasApproval = expense.approvals.some(
        (a) => a.approverId === userId,
      );
      if (!hasApproval) throw new ForbiddenException('Access denied');
    }

    // SAP post hata/başarı loglarını çek
    const sapFailLog = await this.prisma.auditLog.findFirst({
      where: { expenseId: id, action: 'SAP_POST_FAILED' },
      orderBy: { createdAt: 'desc' },
    });
    const sapSuccessLog = await this.prisma.auditLog.findFirst({
      where: { expenseId: id, action: 'POSTED_TO_SAP' },
      orderBy: { createdAt: 'desc' },
    });

    let sapStatus: string;
    if (expense.status === ExpenseStatus.POSTED_TO_SAP)
      sapStatus = expense.sapDocumentNumber?.startsWith('SAP-OK-') ? 'FALLBACK' : 'OK';
    else if (sapFailLog) sapStatus = 'FAILED';
    else if (expense.status === ExpenseStatus.FINANCE_APPROVED) sapStatus = 'PENDING';
    else sapStatus = 'NOT_APPLICABLE';

    return {
      ...expense,
      sapStatus,
      sapPostError: sapFailLog?.details || null,
      sapPostSuccess: sapSuccessLog?.details || null,
    };
  }

  async update(id: string, userId: string, dto: UpdateExpenseDto) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');
    if (expense.userId !== userId) throw new ForbiddenException();
    if (expense.status !== ExpenseStatus.DRAFT) {
      throw new BadRequestException('Sadece taslak (Draft) durumundaki masraflar düzenlenebilir.');
    }

    const updateData: any = { ...dto };
    delete updateData.receiptNumber;  // Fiş/fatura no kaydedildikten sonra değiştirilemez
    if (updateData.expenseDate) {
      updateData.expenseDate = new Date(updateData.expenseDate);
    }

    return this.prisma.expense.update({
      where: { id },
      data: updateData,
    });
  }

  // ─── Finance/Admin: SAP hatası olan masrafın alanlarını düzelt ──────────
  async sapFixUpdate(id: string, approverId: string, dto: UpdateExpenseDto) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');

    const updateData: any = { ...dto };
    delete updateData.receiptNumber;
    if (updateData.expenseDate) {
      updateData.expenseDate = new Date(updateData.expenseDate);
    }

    const updated = await this.prisma.expense.update({
      where: { id },
      data: updateData,
    });

    await this.createAuditLog(
      approverId,
      id,
      'SAP_FIX_UPDATE',
      `SAP fix: ${Object.keys(updateData).join(', ')} güncellendi`,
    );

    return updated;
  }

  async delete(id: string, userId: string) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');
    if (expense.userId !== userId) throw new ForbiddenException();
    const deletableStatuses: ExpenseStatus[] = [ExpenseStatus.DRAFT, ExpenseStatus.SUBMITTED, ExpenseStatus.REJECTED];
    if (!deletableStatuses.includes(expense.status as ExpenseStatus)) {
      throw new BadRequestException('Yalnızca taslak, gönderilmiş veya reddedilmiş masraflar silinebilir.');
    }

    // Önce ilişkili kayıtları sil (approvals, audit logs)
    await this.prisma.approval.deleteMany({ where: { expenseId: id } });
    await this.prisma.auditLog.deleteMany({ where: { expenseId: id } });

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
      return expense;
    }

    // Policy check — ihlal varsa BadRequestException fırlatır
    await this.policy.checkExpense(id);

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
    } else {
      // Manager'ı yoksa (üst yönetici atanmamış) → Finance/Admin'e yönlendir
      const fallbackApprover = await this.prisma.user.findFirst({
        where: { role: { in: ['FINANCE', 'ADMIN'] }, isApproved: true },
        orderBy: { role: 'asc' }, // ADMIN < FINANCE alfabetik → Finance önce gelir
      });
      if (fallbackApprover) {
        await this.prisma.approval.create({
          data: {
            expenseId: id,
            approverId: fallbackApprover.id,
          },
        });
        this.logger.log(
          `No manager found for user ${userId} — approval assigned to ${fallbackApprover.role} ${fallbackApprover.id}`,
        );
      }
    }

    await this.createAuditLog(userId, id, 'SUBMITTED', 'Expense submitted for approval');

    return updated;
  }

  async approve(id: string, approverId: string, comment?: string) {
    const approver = await this.prisma.user.findUnique({
      where: { id: approverId },
    });

    const isElevated = approver?.role === 'ADMIN' || approver?.role === 'FINANCE';

    let approval = await this.prisma.approval.findFirst({
      where: { expenseId: id, approverId, status: 'PENDING' },
    });

    // Admin/Finance: approval kaydı yoksa otomatik oluştur (takılı kalan masraflar için)
    if (!approval && isElevated) {
      approval = await this.prisma.approval.create({
        data: { expenseId: id, approverId, status: 'PENDING' },
      });
    }

    if (!approval) throw new NotFoundException('No pending approval found');

    let newStatus: ExpenseStatus;
    if (approver?.role === 'MANAGER') {
      newStatus = ExpenseStatus.MANAGER_APPROVED;
    } else if (approver?.role === 'FINANCE' || approver?.role === 'ADMIN') {
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

    // Push notification to expense owner
    const owner = await this.prisma.user.findUnique({
      where: { id: updated.userId },
      select: { fcmToken: true } as any,
    });
    if ((owner as any)?.fcmToken) {
      await this.push.sendToToken(
        (owner as any).fcmToken,
        'Masrafınız Onaylandı',
        `Masrafınız onaylandı${comment ? ': ' + comment : '.'}`,
        { expenseId: id },
      );
    }

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
        // Auto-Finance-approve da SAP kuyruğuna ekle
        this.logger.log(`Auto-Finance-approved — enqueueing expense ${id} for SAP posting`);
        this.sapQueue.enqueue(id).catch((err) => {
          this.logger.error(`Failed to enqueue auto-finance-approved expense ${id}: ${err.message}`);
        });
      }
    }

    // ─── Finance onayında SAP kuyruğuna ekle (asenkron) ─────────────────────
    if (newStatus === ExpenseStatus.FINANCE_APPROVED) {
      this.logger.log(`Finance approved — enqueueing expense ${id} for SAP posting`);
      this.sapQueue.enqueue(id).then(() => {
        this.logger.log(`Expense ${id} enqueued for SAP posting`);
      }).catch((err) => {
        this.logger.error(`Failed to enqueue expense ${id}: ${err.message}`);
      });
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

    const owner = await this.prisma.user.findUnique({
      where: { id: updated.userId },
      select: { fcmToken: true } as any,
    });
    if ((owner as any)?.fcmToken) {
      await this.push.sendToToken(
        (owner as any).fcmToken,
        'Masrafınız Reddedildi',
        `Masrafınız reddedildi: ${comment}`,
        { expenseId: id },
      );
    }

    return updated;
  }

  async getPendingApprovals(approverId: string) {
    const approver = await this.prisma.user.findUnique({
      where: { id: approverId },
      select: { role: true },
    });

    const regularApprovals = await this.prisma.approval.findMany({
      where: { approverId, status: 'PENDING' },
      include: {
        expense: {
          include: { user: { select: { name: true, email: true, department: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Finance/Admin: approval kaydı olmadan takılı kalan SUBMITTED masrafları da göster
    if (approver?.role === 'FINANCE' || approver?.role === 'ADMIN') {
      const regularExpenseIds = regularApprovals.map((a) => a.expense.id);

      const stuckExpenses = await this.prisma.expense.findMany({
        where: {
          status: { in: [ExpenseStatus.SUBMITTED, ExpenseStatus.MANAGER_APPROVED] },
          id: { notIn: regularExpenseIds },
          approvals: { none: { status: 'PENDING' } },
        },
        include: {
          user: { select: { name: true, email: true, department: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Sahte approval nesnesi olarak döndür (id: 'virtual-{expenseId}')
      const virtualApprovals = stuckExpenses.map((e) => ({
        id: `virtual-${e.id}`,
        expenseId: e.id,
        approverId,
        status: 'PENDING',
        comment: null,
        actionDate: null,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
        expense: e,
      }));

      return [...regularApprovals, ...virtualApprovals];
    }

    return regularApprovals;
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

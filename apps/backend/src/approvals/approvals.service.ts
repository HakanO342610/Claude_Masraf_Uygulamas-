import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ApprovalsService {
  constructor(private prisma: PrismaService) {}

  async getApprovalHistory(expenseId: string) {
    return this.prisma.approval.findMany({
      where: { expenseId },
      include: {
        approver: { select: { name: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getMyApprovals(approverId: string, status?: string) {
    const where: any = { approverId };
    if (status) where.status = status;

    return this.prisma.approval.findMany({
      where,
      include: {
        expense: {
          include: {
            user: { select: { name: true, email: true, department: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

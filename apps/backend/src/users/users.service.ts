import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        department: true,
        role: true,
        sapEmployeeId: true,
        isApproved: true,
        isEmailConfirmed: true,
        createdAt: true,
      },
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        department: true,
        role: true,
        sapEmployeeId: true,
        managerId: true,
        isApproved: true,
        isEmailConfirmed: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateRole(id: string, role: UserRole) {
    return this.prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, name: true, email: true, role: true },
    });
  }

  async assignManager(userId: string, managerId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { managerId },
      select: { id: true, name: true, managerId: true },
    });
  }

  async approveUser(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { isApproved: true },
      select: { id: true, name: true, email: true, isApproved: true },
    });
  }

  async updateUser(id: string, data: { name?: string; email?: string; department?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true, name: true, email: true, department: true,
        role: true, isApproved: true, isEmailConfirmed: true,
      },
    });
  }

  async updateFcmToken(userId: string, fcmToken: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { fcmToken },
      select: { id: true },
    });
  }

  async deleteUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    // Delete all related records in correct order (foreign key dependencies)
    const expenses = await this.prisma.expense.findMany({ where: { userId: id }, select: { id: true } });
    const expenseIds = expenses.map(e => e.id);

    if (expenseIds.length > 0) {
      await this.prisma.sapPostingQueue.deleteMany({ where: { expenseId: { in: expenseIds } } });
      await this.prisma.approval.deleteMany({ where: { expenseId: { in: expenseIds } } });
      await this.prisma.auditLog.deleteMany({ where: { expenseId: { in: expenseIds } } });
      await this.prisma.receipt.deleteMany({ where: { expenseId: { in: expenseIds } } });
    }

    await this.prisma.receipt.deleteMany({ where: { uploadedBy: id } });
    await this.prisma.approval.deleteMany({ where: { approverId: id } });
    await this.prisma.auditLog.deleteMany({ where: { userId: id } });
    await this.prisma.expense.deleteMany({ where: { userId: id } });
    await this.prisma.refreshToken.deleteMany({ where: { userId: id } });

    // Clear manager references from other users
    await this.prisma.user.updateMany({ where: { managerId: id }, data: { managerId: null } });

    return this.prisma.user.delete({ where: { id } });
  }

  async findAuditLogs(query: { page?: number; limit?: number; userId?: string; action?: string }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.userId) where.userId = query.userId;
    if (query.action) where.action = { contains: query.action, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          expense: { select: { id: true, category: true, amount: true, currency: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}

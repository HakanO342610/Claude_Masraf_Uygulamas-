import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getSummary(from?: string, to?: string) {
    const where = this.buildDateFilter(from, to);

    const [totalResult, categoryBreakdown, statusBreakdown, count] =
      await Promise.all([
        this.prisma.expense.aggregate({
          where,
          _sum: { amount: true },
          _avg: { amount: true },
          _max: { amount: true },
          _count: true,
        }),
        this.prisma.expense.groupBy({
          by: ['category'],
          where,
          _sum: { amount: true },
          _count: true,
          orderBy: { _sum: { amount: 'desc' } },
        }),
        this.prisma.expense.groupBy({
          by: ['status'],
          where,
          _count: true,
        }),
        this.prisma.expense.count({ where }),
      ]);

    return {
      totalExpenses: count,
      totalAmount: totalResult._sum.amount || 0,
      averageAmount: totalResult._avg.amount || 0,
      maxAmount: totalResult._max.amount || 0,
      byCategory: categoryBreakdown.map((c) => ({
        category: c.category,
        count: c._count,
        totalAmount: c._sum.amount || 0,
      })),
      byStatus: statusBreakdown.map((s) => ({
        status: s.status,
        count: s._count,
      })),
    };
  }

  async getByDepartment(from?: string, to?: string) {
    const where = this.buildDateFilter(from, to);

    const expenses = await this.prisma.expense.findMany({
      where,
      include: { user: { select: { department: true } } },
    });

    const departmentMap = new Map<
      string,
      { count: number; totalAmount: number }
    >();

    for (const expense of expenses) {
      const dept = expense.user.department || 'Unassigned';
      const existing = departmentMap.get(dept) || { count: 0, totalAmount: 0 };
      existing.count++;
      existing.totalAmount += Number(expense.amount);
      departmentMap.set(dept, existing);
    }

    return Array.from(departmentMap.entries())
      .map(([department, data]) => ({ department, ...data }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }

  async getByCategory(from?: string, to?: string) {
    const where = this.buildDateFilter(from, to);

    const result = await this.prisma.expense.groupBy({
      by: ['category'],
      where,
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: 'desc' } },
    });

    const total = result.reduce(
      (sum, r) => sum + Number(r._sum.amount || 0),
      0,
    );

    return result.map((r) => ({
      category: r.category,
      count: r._count,
      totalAmount: r._sum.amount || 0,
      percentage: total > 0 ? +((Number(r._sum.amount || 0) / total) * 100).toFixed(1) : 0,
    }));
  }

  async getMonthly(year?: number) {
    const targetYear = year || new Date().getFullYear();
    const startDate = new Date(targetYear, 0, 1);
    const endDate = new Date(targetYear + 1, 0, 1);

    const expenses = await this.prisma.expense.findMany({
      where: {
        expenseDate: { gte: startDate, lt: endDate },
      },
      select: { expenseDate: true, amount: true },
    });

    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      monthName: new Date(targetYear, i).toLocaleString('en-US', {
        month: 'short',
      }),
      count: 0,
      totalAmount: 0,
    }));

    for (const expense of expenses) {
      const month = expense.expenseDate.getMonth();
      months[month].count++;
      months[month].totalAmount += Number(expense.amount);
    }

    return { year: targetYear, months };
  }

  async exportCsv(from?: string, to?: string): Promise<string> {
    const where = this.buildDateFilter(from, to);

    const expenses = await this.prisma.expense.findMany({
      where,
      include: {
        user: { select: { name: true, email: true, department: true } },
      },
      orderBy: { expenseDate: 'desc' },
    });

    const headers = [
      'Date',
      'Employee',
      'Email',
      'Department',
      'Category',
      'Amount',
      'Currency',
      'Cost Center',
      'Project Code',
      'Status',
      'SAP Document',
      'Description',
    ];

    const rows = expenses.map((e) => [
      e.expenseDate.toISOString().split('T')[0],
      this.escapeCsv(e.user.name),
      e.user.email,
      e.user.department || '',
      e.category,
      Number(e.amount).toFixed(2),
      e.currency,
      e.costCenter || '',
      e.projectCode || '',
      e.status,
      e.sapDocumentNumber || '',
      this.escapeCsv(e.description || ''),
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  private escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private buildDateFilter(from?: string, to?: string) {
    const where: any = {};
    if (from || to) {
      where.expenseDate = {};
      if (from) where.expenseDate.gte = new Date(from);
      if (to) where.expenseDate.lte = new Date(to);
    }
    return where;
  }
}

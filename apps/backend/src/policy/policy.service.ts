import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePolicyRuleDto } from './dto/create-policy-rule.dto';

@Injectable()
export class PolicyService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.policyRule.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async create(dto: CreatePolicyRuleDto) {
    return this.prisma.policyRule.create({ data: dto });
  }

  async update(id: string, dto: Partial<CreatePolicyRuleDto>) {
    return this.prisma.policyRule.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    return this.prisma.policyRule.delete({ where: { id } });
  }

  /**
   * Checks active policy rules against an expense.
   * Throws BadRequestException with a descriptive message if any rule is violated.
   */
  async checkExpense(expenseId: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
      include: { receipts: { select: { id: true } } },
    });

    if (!expense) return;

    const rules = await this.prisma.policyRule.findMany({
      where: {
        isActive: true,
        OR: [{ category: null }, { category: expense.category }],
      },
    });

    const violations: string[] = [];

    for (const rule of rules) {
      // --- Fiş zorunluluğu kontrolü ---
      if (rule.requireReceiptAbove !== null) {
        const limit = Number(rule.requireReceiptAbove);
        if (Number(expense.amount) > limit && expense.receipts.length === 0) {
          violations.push(
            `"${rule.name}": ${limit} ${expense.currency} üzeri masraflar için fiş eklenmesi zorunludur.`,
          );
        }
      }

      // --- Aylık limit kontrolü ---
      const now = new Date(expense.expenseDate);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      const agg = await this.prisma.expense.aggregate({
        _sum: { amount: true },
        where: {
          userId: expense.userId,
          category: rule.category ?? undefined,
          expenseDate: { gte: startOfMonth, lte: endOfMonth },
          id: { not: expenseId }, // Mevcut masrafı hariç tut
          status: { notIn: ['DRAFT', 'REJECTED'] },
        },
      });

      const monthlyTotal = Number(agg._sum.amount ?? 0) + Number(expense.amount);
      const monthlyLimit = Number(rule.monthlyLimit);

      if (monthlyTotal > monthlyLimit) {
        const categoryLabel = rule.category ? `"${rule.category}" kategorisi` : 'tüm kategoriler';
        violations.push(
          `"${rule.name}": ${categoryLabel} için aylık limit ${monthlyLimit} ${expense.currency}. Bu ay toplam: ${monthlyTotal.toFixed(2)} ${expense.currency}.`,
        );
      }
    }

    if (violations.length > 0) {
      throw new BadRequestException(
        'Harcama politikası ihlali:\n' + violations.join('\n'),
      );
    }
  }
}

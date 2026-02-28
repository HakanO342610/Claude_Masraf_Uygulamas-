import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PolicyService } from './policy.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  policyRule: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  expense: {
    findUnique: jest.fn(),
    aggregate: jest.fn(),
  },
};

const baseExpense = {
  id: 'exp1',
  userId: 'user1',
  amount: 500,
  currency: 'TRY',
  category: 'MEALS',
  expenseDate: new Date('2025-03-15'),
  receipts: [],
};

describe('PolicyService', () => {
  let service: PolicyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PolicyService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PolicyService>(PolicyService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all policy rules', async () => {
      const rules = [{ id: 'r1', name: 'Test Rule', monthlyLimit: 5000, isActive: true }];
      mockPrisma.policyRule.findMany.mockResolvedValue(rules);

      const result = await service.findAll();
      expect(result).toEqual(rules);
    });
  });

  describe('create', () => {
    it('should create a policy rule', async () => {
      const dto = { name: 'Yemek Limiti', monthlyLimit: 3000, category: 'MEALS' };
      mockPrisma.policyRule.create.mockResolvedValue({ id: 'r1', ...dto });

      const result = await service.create(dto as any);
      expect(result.name).toBe('Yemek Limiti');
    });
  });

  describe('checkExpense', () => {
    it('should pass when no active rules exist', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue(baseExpense);
      mockPrisma.policyRule.findMany.mockResolvedValue([]);

      await expect(service.checkExpense('exp1')).resolves.toBeUndefined();
    });

    it('should pass when expense is within monthly limit', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue(baseExpense);
      mockPrisma.policyRule.findMany.mockResolvedValue([
        { id: 'r1', name: 'Yemek Limiti', category: 'MEALS', monthlyLimit: 3000, requireReceiptAbove: null, isActive: true },
      ]);
      mockPrisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 200 } });

      await expect(service.checkExpense('exp1')).resolves.toBeUndefined();
    });

    it('should throw when monthly limit is exceeded', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue(baseExpense);
      mockPrisma.policyRule.findMany.mockResolvedValue([
        { id: 'r1', name: 'Yemek Limiti', category: 'MEALS', monthlyLimit: 600, requireReceiptAbove: null, isActive: true },
      ]);
      // 200 existing + 500 this expense = 700 > 600
      mockPrisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 200 } });

      await expect(service.checkExpense('exp1')).rejects.toThrow(BadRequestException);
    });

    it('should throw when receipt is required but missing', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue({ ...baseExpense, amount: 300, receipts: [] });
      mockPrisma.policyRule.findMany.mockResolvedValue([
        { id: 'r2', name: 'Fiş Zorunlu', category: null, monthlyLimit: 99999, requireReceiptAbove: 200, isActive: true },
      ]);
      mockPrisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 0 } });

      await expect(service.checkExpense('exp1')).rejects.toThrow(BadRequestException);
    });

    it('should pass when receipt is present and amount exceeds threshold', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue({
        ...baseExpense,
        amount: 300,
        receipts: [{ id: 'rec1' }],
      });
      mockPrisma.policyRule.findMany.mockResolvedValue([
        { id: 'r2', name: 'Fiş Zorunlu', category: null, monthlyLimit: 99999, requireReceiptAbove: 200, isActive: true },
      ]);
      mockPrisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 0 } });

      await expect(service.checkExpense('exp1')).resolves.toBeUndefined();
    });

    it('should return early if expense not found', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue(null);

      await expect(service.checkExpense('nonexistent')).resolves.toBeUndefined();
      expect(mockPrisma.policyRule.findMany).not.toHaveBeenCalled();
    });
  });
});

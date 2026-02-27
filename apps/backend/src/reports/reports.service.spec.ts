import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  expense: {
    aggregate: jest.fn(),
    groupBy: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    jest.clearAllMocks();
  });

  describe('getSummary', () => {
    it('should return expense summary', async () => {
      mockPrisma.expense.aggregate.mockResolvedValue({
        _sum: { amount: 10000 },
        _avg: { amount: 500 },
        _max: { amount: 3000 },
        _count: 20,
      });
      mockPrisma.expense.groupBy
        .mockResolvedValueOnce([
          { category: 'Travel', _sum: { amount: 6000 }, _count: 12 },
          { category: 'Food', _sum: { amount: 4000 }, _count: 8 },
        ])
        .mockResolvedValueOnce([
          { status: 'DRAFT', _count: 5 },
          { status: 'SUBMITTED', _count: 15 },
        ]);
      mockPrisma.expense.count.mockResolvedValue(20);

      const result = await service.getSummary();

      expect(result.totalExpenses).toBe(20);
      expect(result.totalAmount).toBe(10000);
      expect(result.averageAmount).toBe(500);
      expect(result.byCategory).toHaveLength(2);
      expect(result.byStatus).toHaveLength(2);
    });

    it('should apply date filters', async () => {
      mockPrisma.expense.aggregate.mockResolvedValue({
        _sum: { amount: 0 },
        _avg: { amount: 0 },
        _max: { amount: 0 },
        _count: 0,
      });
      mockPrisma.expense.groupBy.mockResolvedValue([]);
      mockPrisma.expense.count.mockResolvedValue(0);

      await service.getSummary('2025-01-01', '2025-12-31');

      const calledWith = mockPrisma.expense.aggregate.mock.calls[0][0].where;
      expect(calledWith.expenseDate.gte).toEqual(new Date('2025-01-01'));
      expect(calledWith.expenseDate.lte).toEqual(new Date('2025-12-31'));
    });
  });

  describe('getByDepartment', () => {
    it('should group expenses by department', async () => {
      mockPrisma.expense.findMany.mockResolvedValue([
        { amount: 1000, user: { department: 'Engineering' } },
        { amount: 2000, user: { department: 'Engineering' } },
        { amount: 500, user: { department: 'Sales' } },
      ]);

      const result = await service.getByDepartment();

      expect(result).toHaveLength(2);
      expect(result[0].department).toBe('Engineering');
      expect(result[0].totalAmount).toBe(3000);
      expect(result[0].count).toBe(2);
      expect(result[1].department).toBe('Sales');
    });
  });

  describe('getByCategory', () => {
    it('should return category breakdown with percentages', async () => {
      mockPrisma.expense.groupBy.mockResolvedValue([
        { category: 'Travel', _sum: { amount: 7500 }, _count: 10 },
        { category: 'Food', _sum: { amount: 2500 }, _count: 5 },
      ]);

      const result = await service.getByCategory();

      expect(result).toHaveLength(2);
      expect(result[0].category).toBe('Travel');
      expect(result[0].percentage).toBe(75);
      expect(result[1].percentage).toBe(25);
    });
  });

  describe('getMonthly', () => {
    it('should return 12 months of data', async () => {
      mockPrisma.expense.findMany.mockResolvedValue([
        { expenseDate: new Date('2025-01-15'), amount: 1000 },
        { expenseDate: new Date('2025-01-20'), amount: 500 },
        { expenseDate: new Date('2025-03-10'), amount: 2000 },
      ]);

      const result = await service.getMonthly(2025);

      expect(result.year).toBe(2025);
      expect(result.months).toHaveLength(12);
      expect(result.months[0].totalAmount).toBe(1500); // January
      expect(result.months[0].count).toBe(2);
      expect(result.months[2].totalAmount).toBe(2000); // March
    });
  });
});

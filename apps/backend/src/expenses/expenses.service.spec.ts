import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  expense: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  approval: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
};

describe('ExpensesService', () => {
  let service: ExpensesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ExpensesService>(ExpensesService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create an expense', async () => {
      const dto = {
        expenseDate: '2025-01-15',
        amount: 500,
        category: 'Travel',
        description: 'Business trip',
      };
      const expected = { id: '1', userId: 'user1', ...dto, status: 'DRAFT' };
      mockPrisma.expense.create.mockResolvedValue(expected);

      const result = await service.create('user1', dto);

      expect(result).toEqual(expected);
      expect(mockPrisma.expense.create).toHaveBeenCalledWith({
        data: {
          userId: 'user1',
          expenseDate: new Date('2025-01-15'),
          amount: 500,
          currency: 'TRY',
          taxAmount: undefined,
          category: 'Travel',
          projectCode: undefined,
          costCenter: undefined,
          description: 'Business trip',
        },
        include: { user: { select: { name: true, email: true } } },
      });
    });
  });

  describe('findById', () => {
    it('should return expense for owner', async () => {
      const expense = {
        id: '1',
        userId: 'user1',
        approvals: [],
      };
      mockPrisma.expense.findUnique.mockResolvedValue(expense);

      const result = await service.findById('1', 'user1');
      expect(result).toEqual(expense);
    });

    it('should throw NotFoundException when expense not found', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue(null);

      await expect(service.findById('1', 'user1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException for non-owner without approval', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue({
        id: '1',
        userId: 'user1',
        approvals: [{ approverId: 'user3' }],
      });

      await expect(service.findById('1', 'user2')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow access for approver', async () => {
      const expense = {
        id: '1',
        userId: 'user1',
        approvals: [{ approverId: 'approver1' }],
      };
      mockPrisma.expense.findUnique.mockResolvedValue(expense);

      const result = await service.findById('1', 'approver1');
      expect(result).toEqual(expense);
    });
  });

  describe('update', () => {
    it('should update a draft expense', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue({
        id: '1',
        userId: 'user1',
        status: 'DRAFT',
      });
      mockPrisma.expense.update.mockResolvedValue({ id: '1', amount: 600 });

      const result = await service.update('1', 'user1', { amount: 600 });
      expect(result.amount).toBe(600);
    });

    it('should reject update for non-draft expense', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue({
        id: '1',
        userId: 'user1',
        status: 'SUBMITTED',
      });

      await expect(
        service.update('1', 'user1', { amount: 600 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject update from non-owner', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue({
        id: '1',
        userId: 'user1',
        status: 'DRAFT',
      });

      await expect(
        service.update('1', 'user2', { amount: 600 }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('submit', () => {
    it('should submit a draft expense and create approval', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue({
        id: '1',
        userId: 'user1',
        status: 'DRAFT',
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user1',
        managerId: 'manager1',
      });
      mockPrisma.expense.update.mockResolvedValue({
        id: '1',
        status: 'SUBMITTED',
      });
      mockPrisma.approval.create.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.submit('1', 'user1');

      expect(result.status).toBe('SUBMITTED');
      expect(mockPrisma.approval.create).toHaveBeenCalledWith({
        data: { expenseId: '1', approverId: 'manager1' },
      });
    });

    it('should reject submit for non-draft expense', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue({
        id: '1',
        userId: 'user1',
        status: 'SUBMITTED',
      });

      await expect(service.submit('1', 'user1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('approve', () => {
    it('should approve as manager and escalate to finance', async () => {
      mockPrisma.approval.findFirst.mockResolvedValue({
        id: 'a1',
        expenseId: '1',
        approverId: 'manager1',
        status: 'PENDING',
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'manager1',
        role: 'MANAGER',
      });
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'finance1',
        name: 'Finance User',
      });
      mockPrisma.approval.update.mockResolvedValue({});
      mockPrisma.expense.update.mockResolvedValue({
        id: '1',
        status: 'MANAGER_APPROVED',
      });
      mockPrisma.approval.create.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.approve('1', 'manager1', 'Looks good');

      expect(result.status).toBe('MANAGER_APPROVED');
      expect(mockPrisma.approval.create).toHaveBeenCalledWith({
        data: { expenseId: '1', approverId: 'finance1' },
      });
    });

    it('should throw NotFoundException when no pending approval', async () => {
      mockPrisma.approval.findFirst.mockResolvedValue(null);

      await expect(service.approve('1', 'user1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('reject', () => {
    it('should reject an expense', async () => {
      mockPrisma.approval.findFirst.mockResolvedValue({
        id: 'a1',
        expenseId: '1',
      });
      mockPrisma.approval.update.mockResolvedValue({});
      mockPrisma.expense.update.mockResolvedValue({
        id: '1',
        status: 'REJECTED',
      });
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.reject('1', 'manager1', 'Missing receipt');
      expect(result.status).toBe('REJECTED');
    });
  });
});

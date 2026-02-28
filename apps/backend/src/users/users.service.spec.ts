import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
  expense: { findMany: jest.fn(), deleteMany: jest.fn() },
  sapPostingQueue: { deleteMany: jest.fn() },
  approval: { deleteMany: jest.fn() },
  auditLog: {
    findMany: jest.fn(),
    count: jest.fn(),
    deleteMany: jest.fn(),
  },
  receipt: { deleteMany: jest.fn() },
  refreshToken: { deleteMany: jest.fn() },
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      const users = [{ id: 'u1', name: 'Alice', email: 'alice@test.com', role: 'EMPLOYEE' }];
      mockPrisma.user.findMany.mockResolvedValue(users);

      const result = await service.findAll();
      expect(result).toEqual(users);
    });
  });

  describe('findById', () => {
    it('should return a user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', name: 'Alice' });
      const result = await service.findById('u1');
      expect(result.id).toBe('u1');
    });

    it('should throw NotFoundException for missing user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateFcmToken', () => {
    it('should update FCM token', async () => {
      mockPrisma.user.update.mockResolvedValue({ id: 'u1' });
      const result = await service.updateFcmToken('u1', 'token-abc');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { fcmToken: 'token-abc' },
        select: { id: true },
      });
      expect(result.id).toBe('u1');
    });
  });

  describe('approveUser', () => {
    it('should set isApproved to true', async () => {
      mockPrisma.user.update.mockResolvedValue({ id: 'u1', isApproved: true });
      const result = await service.approveUser('u1');
      expect(result.isApproved).toBe(true);
    });
  });

  describe('updateRole', () => {
    it('should update user role', async () => {
      mockPrisma.user.update.mockResolvedValue({ id: 'u1', role: 'MANAGER' });
      const result = await service.updateRole('u1', 'MANAGER' as any);
      expect(result.role).toBe('MANAGER');
    });
  });

  describe('findAuditLogs', () => {
    it('should return paginated audit logs', async () => {
      const logs = [{ id: 'l1', action: 'APPROVED', userId: 'u1', user: {}, expense: null }];
      mockPrisma.auditLog.findMany.mockResolvedValue(logs);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      const result = await service.findAuditLogs({ page: 1, limit: 10 });

      expect(result.data).toEqual(logs);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should apply action filter (case-insensitive)', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await service.findAuditLogs({ action: 'APPROVED' });

      const whereArg = mockPrisma.auditLog.findMany.mock.calls[0][0].where;
      expect(whereArg.action).toEqual({ contains: 'APPROVED', mode: 'insensitive' });
    });

    it('should apply userId filter', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await service.findAuditLogs({ userId: 'u1' });

      const whereArg = mockPrisma.auditLog.findMany.mock.calls[0][0].where;
      expect(whereArg.userId).toBe('u1');
    });
  });
});

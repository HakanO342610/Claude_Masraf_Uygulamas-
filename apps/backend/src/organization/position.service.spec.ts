import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PositionService } from './position.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  position: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('PositionService', () => {
  let service: PositionService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PositionService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<PositionService>(PositionService);
  });

  describe('findAll', () => {
    it('returns all positions without filter', async () => {
      const positions = [{ id: '1', title: 'Dev', code: 'DEV' }];
      mockPrisma.position.findMany.mockResolvedValue(positions);

      const result = await service.findAll();
      expect(result).toEqual(positions);
      expect(mockPrisma.position.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('filters by orgId and departmentId', async () => {
      mockPrisma.position.findMany.mockResolvedValue([]);
      await service.findAll('org-1', 'dept-1');
      expect(mockPrisma.position.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org-1', departmentId: 'dept-1' } }),
      );
    });
  });

  describe('findOne', () => {
    it('returns position when found', async () => {
      const pos = { id: '1', title: 'Dev', childPositions: [], users: [] };
      mockPrisma.position.findUnique.mockResolvedValue(pos);
      const result = await service.findOne('1');
      expect(result.id).toBe('1');
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.position.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates position with level 0 when no parent', async () => {
      mockPrisma.position.create.mockResolvedValue({ id: '1', title: 'GM', level: 0 });
      await service.create({ title: 'GM', code: 'POS-GM' });
      expect(mockPrisma.position.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ level: 0 }) }),
      );
    });

    it('auto-calculates level from parent position', async () => {
      mockPrisma.position.findUnique.mockResolvedValue({ id: 'parent', level: 1 });
      mockPrisma.position.create.mockResolvedValue({ id: '2', title: 'Mgr', level: 2 });

      await service.create({ title: 'Mgr', code: 'POS-MGR', parentPositionId: 'parent' });

      expect(mockPrisma.position.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ level: 2 }) }),
      );
    });
  });

  describe('update', () => {
    it('throws NotFoundException when position not found', async () => {
      mockPrisma.position.findUnique.mockResolvedValue(null);
      await expect(service.update('missing', { title: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('updates title successfully', async () => {
      mockPrisma.position.findUnique.mockResolvedValue({ id: '1', level: 0 });
      mockPrisma.position.update.mockResolvedValue({ id: '1', title: 'New Title' });

      await service.update('1', { title: 'New Title' });
      expect(mockPrisma.position.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ title: 'New Title' }) }),
      );
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when not found', async () => {
      mockPrisma.position.findUnique.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
    });

    it('throws error when position has children', async () => {
      mockPrisma.position.findUnique.mockResolvedValue({ id: '1', _count: { childPositions: 1, users: 0 } });
      await expect(service.remove('1')).rejects.toThrow('Alt pozisyonlar');
    });

    it('throws error when position has users', async () => {
      mockPrisma.position.findUnique.mockResolvedValue({ id: '1', _count: { childPositions: 0, users: 2 } });
      await expect(service.remove('1')).rejects.toThrow('kullanıcılar');
    });

    it('deletes position when empty', async () => {
      mockPrisma.position.findUnique.mockResolvedValue({ id: '1', _count: { childPositions: 0, users: 0 } });
      mockPrisma.position.delete.mockResolvedValue({ id: '1' });

      await service.remove('1');
      expect(mockPrisma.position.delete).toHaveBeenCalledWith({ where: { id: '1' } });
    });
  });
});

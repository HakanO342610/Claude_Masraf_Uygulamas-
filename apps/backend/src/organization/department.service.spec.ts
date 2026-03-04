import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DepartmentService } from './department.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  department: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('DepartmentService', () => {
  let service: DepartmentService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<DepartmentService>(DepartmentService);
  });

  describe('findTree', () => {
    it('returns flat list converted to tree', async () => {
      const flat = [
        { id: '1', name: 'Root', parentId: null, level: 0 },
        { id: '2', name: 'Child', parentId: '1', level: 1 },
      ];
      mockPrisma.department.findMany.mockResolvedValue(flat);

      const result = await service.findTree();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children[0].id).toBe('2');
    });

    it('returns multiple root nodes when no parent', async () => {
      const flat = [
        { id: '1', name: 'Root A', parentId: null, level: 0 },
        { id: '2', name: 'Root B', parentId: null, level: 0 },
      ];
      mockPrisma.department.findMany.mockResolvedValue(flat);

      const result = await service.findTree();
      expect(result).toHaveLength(2);
    });

    it('filters by orgId when provided', async () => {
      mockPrisma.department.findMany.mockResolvedValue([]);
      await service.findTree('org-1');
      expect(mockPrisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org-1' } }),
      );
    });
  });

  describe('findOne', () => {
    it('returns department when found', async () => {
      const dept = { id: '1', name: 'IT', code: 'IT', children: [], positions: [], users: [] };
      mockPrisma.department.findUnique.mockResolvedValue(dept);
      const result = await service.findOne('1');
      expect(result.id).toBe('1');
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.department.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates department with level 0 when no parent', async () => {
      mockPrisma.department.create.mockResolvedValue({ id: '1', name: 'Root', level: 0 });

      await service.create({ name: 'Root', code: 'ROOT' });

      expect(mockPrisma.department.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ level: 0 }) }),
      );
    });

    it('auto-calculates level from parent', async () => {
      mockPrisma.department.findUnique.mockResolvedValue({ id: 'parent', level: 1 });
      mockPrisma.department.create.mockResolvedValue({ id: '2', name: 'Child', level: 2 });

      await service.create({ name: 'Child', code: 'CHD', parentId: 'parent' });

      expect(mockPrisma.department.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ level: 2 }) }),
      );
    });
  });

  describe('update', () => {
    it('throws NotFoundException when department not found', async () => {
      mockPrisma.department.findUnique.mockResolvedValue(null);
      await expect(service.update('missing', { name: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('updates name successfully', async () => {
      mockPrisma.department.findUnique.mockResolvedValue({ id: '1', level: 0 });
      mockPrisma.department.update.mockResolvedValue({ id: '1', name: 'New Name' });

      await service.update('1', { name: 'New Name' });
      expect(mockPrisma.department.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'New Name' }) }),
      );
    });

    it('sets level to 0 when parentId is null', async () => {
      mockPrisma.department.findUnique.mockResolvedValue({ id: '1', level: 2 });
      mockPrisma.department.update.mockResolvedValue({ id: '1', level: 0 });

      await service.update('1', { parentId: null });
      expect(mockPrisma.department.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ level: 0, parentId: null }) }),
      );
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when not found', async () => {
      mockPrisma.department.findUnique.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
    });

    it('throws error when department has children', async () => {
      mockPrisma.department.findUnique.mockResolvedValue({ id: '1', _count: { children: 2, users: 0 } });
      await expect(service.remove('1')).rejects.toThrow('Alt departmanlar');
    });

    it('throws error when department has users', async () => {
      mockPrisma.department.findUnique.mockResolvedValue({ id: '1', _count: { children: 0, users: 3 } });
      await expect(service.remove('1')).rejects.toThrow('kullanıcılar');
    });

    it('deletes department successfully when empty', async () => {
      mockPrisma.department.findUnique.mockResolvedValue({ id: '1', _count: { children: 0, users: 0 } });
      mockPrisma.department.delete.mockResolvedValue({ id: '1' });

      await service.remove('1');
      expect(mockPrisma.department.delete).toHaveBeenCalledWith({ where: { id: '1' } });
    });
  });
});

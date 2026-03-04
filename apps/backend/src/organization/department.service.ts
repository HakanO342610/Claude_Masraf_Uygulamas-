import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateDepartmentDto {
  name: string;
  code: string;
  parentId?: string;
  managerId?: string;
  organizationId?: string;
  level?: number;
}

export interface UpdateDepartmentDto {
  name?: string;
  code?: string;
  parentId?: string | null;
  managerId?: string | null;
  level?: number;
  isActive?: boolean;
}

@Injectable()
export class DepartmentService {
  constructor(private prisma: PrismaService) {}

  /** Hiyerarşik departman ağacı (tree view için) */
  async findTree(orgId?: string) {
    const where: any = {};
    if (orgId) where.organizationId = orgId;

    const allDepts = await this.prisma.department.findMany({
      where,
      include: {
        manager: { select: { id: true, name: true, email: true } },
        _count: { select: { users: true, positions: true } },
      },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });

    // Tree yapısına dönüştür
    const map = new Map<string, any>();
    const roots: any[] = [];

    for (const dept of allDepts) {
      map.set(dept.id, { ...dept, children: [] });
    }

    for (const dept of allDepts) {
      const node = map.get(dept.id);
      if (dept.parentId && map.has(dept.parentId)) {
        map.get(dept.parentId).children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  /** Flat liste (sayfalama, filtreleme) */
  async findAll(orgId?: string) {
    const where: any = {};
    if (orgId) where.organizationId = orgId;

    return this.prisma.department.findMany({
      where,
      include: {
        parent: { select: { id: true, name: true, code: true } },
        manager: { select: { id: true, name: true, email: true } },
        _count: { select: { users: true, positions: true, children: true } },
      },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const dept = await this.prisma.department.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, name: true, code: true } },
        manager: { select: { id: true, name: true, email: true } },
        children: {
          select: { id: true, name: true, code: true, level: true, isActive: true },
          orderBy: { name: 'asc' },
        },
        positions: {
          select: { id: true, title: true, code: true, level: true, isActive: true },
          orderBy: { title: 'asc' },
        },
        users: {
          select: { id: true, name: true, email: true, role: true, jobTitle: true },
          orderBy: { name: 'asc' },
        },
        _count: { select: { users: true, positions: true, children: true } },
      },
    });

    if (!dept) throw new NotFoundException('Department not found');
    return dept;
  }

  async create(dto: CreateDepartmentDto) {
    // Level otomatik hesaplama (parent varsa parent.level + 1)
    let level = dto.level ?? 0;
    if (dto.parentId) {
      const parent = await this.prisma.department.findUnique({ where: { id: dto.parentId } });
      if (parent) level = parent.level + 1;
    }

    return this.prisma.department.create({
      data: {
        name: dto.name,
        code: dto.code,
        parentId: dto.parentId,
        managerId: dto.managerId,
        organizationId: dto.organizationId,
        level,
      },
    });
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    const dept = await this.prisma.department.findUnique({ where: { id } });
    if (!dept) throw new NotFoundException('Department not found');

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.parentId !== undefined) data.parentId = dto.parentId;
    if (dto.managerId !== undefined) data.managerId = dto.managerId;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    // Level yeniden hesapla
    if (dto.parentId) {
      const parent = await this.prisma.department.findUnique({ where: { id: dto.parentId } });
      data.level = parent ? parent.level + 1 : 0;
    } else if (dto.parentId === null) {
      data.level = 0;
    } else if (dto.level !== undefined) {
      data.level = dto.level;
    }

    return this.prisma.department.update({ where: { id }, data });
  }

  async remove(id: string) {
    const dept = await this.prisma.department.findUnique({
      where: { id },
      include: { _count: { select: { children: true, users: true } } },
    });
    if (!dept) throw new NotFoundException('Department not found');
    if (dept._count.children > 0) {
      throw new Error('Alt departmanlar mevcut. Önce alt departmanları silin veya taşıyın.');
    }
    if (dept._count.users > 0) {
      throw new Error('Departmanda kullanıcılar mevcut. Önce kullanıcıları başka departmana taşıyın.');
    }

    return this.prisma.department.delete({ where: { id } });
  }
}

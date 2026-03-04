import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreatePositionDto {
  title: string;
  code: string;
  departmentId?: string;
  parentPositionId?: string;
  organizationId?: string;
  level?: number;
}

export interface UpdatePositionDto {
  title?: string;
  code?: string;
  departmentId?: string | null;
  parentPositionId?: string | null;
  level?: number;
  isActive?: boolean;
}

@Injectable()
export class PositionService {
  constructor(private prisma: PrismaService) {}

  async findAll(orgId?: string, departmentId?: string) {
    const where: any = {};
    if (orgId) where.organizationId = orgId;
    if (departmentId) where.departmentId = departmentId;

    return this.prisma.position.findMany({
      where,
      include: {
        department: { select: { id: true, name: true, code: true } },
        parentPosition: { select: { id: true, title: true, code: true } },
        _count: { select: { users: true, childPositions: true } },
      },
      orderBy: [{ level: 'asc' }, { title: 'asc' }],
    });
  }

  async findOne(id: string) {
    const pos = await this.prisma.position.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true, code: true } },
        parentPosition: { select: { id: true, title: true, code: true } },
        childPositions: {
          select: { id: true, title: true, code: true, level: true, isActive: true },
          orderBy: { title: 'asc' },
        },
        users: {
          select: { id: true, name: true, email: true, role: true, jobTitle: true },
          orderBy: { name: 'asc' },
        },
        _count: { select: { users: true, childPositions: true } },
      },
    });

    if (!pos) throw new NotFoundException('Position not found');
    return pos;
  }

  async create(dto: CreatePositionDto) {
    let level = dto.level ?? 0;
    if (dto.parentPositionId) {
      const parent = await this.prisma.position.findUnique({ where: { id: dto.parentPositionId } });
      if (parent) level = parent.level + 1;
    }

    return this.prisma.position.create({
      data: {
        title: dto.title,
        code: dto.code,
        departmentId: dto.departmentId,
        parentPositionId: dto.parentPositionId,
        organizationId: dto.organizationId,
        level,
      },
    });
  }

  async update(id: string, dto: UpdatePositionDto) {
    const pos = await this.prisma.position.findUnique({ where: { id } });
    if (!pos) throw new NotFoundException('Position not found');

    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.departmentId !== undefined) data.departmentId = dto.departmentId;
    if (dto.parentPositionId !== undefined) data.parentPositionId = dto.parentPositionId;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    if (dto.parentPositionId) {
      const parent = await this.prisma.position.findUnique({ where: { id: dto.parentPositionId } });
      data.level = parent ? parent.level + 1 : 0;
    } else if (dto.parentPositionId === null) {
      data.level = 0;
    } else if (dto.level !== undefined) {
      data.level = dto.level;
    }

    return this.prisma.position.update({ where: { id }, data });
  }

  async remove(id: string) {
    const pos = await this.prisma.position.findUnique({
      where: { id },
      include: { _count: { select: { childPositions: true, users: true } } },
    });
    if (!pos) throw new NotFoundException('Position not found');
    if (pos._count.childPositions > 0) {
      throw new Error('Alt pozisyonlar mevcut. Önce alt pozisyonları silin.');
    }
    if (pos._count.users > 0) {
      throw new Error('Pozisyonda kullanıcılar mevcut. Önce kullanıcıları başka pozisyona taşıyın.');
    }

    return this.prisma.position.delete({ where: { id } });
  }
}

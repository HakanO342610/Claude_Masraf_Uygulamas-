import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto.service';

export interface OrgConfigDto {
  erpType?: string;
  erpConfig?: Record<string, any> | null;
  idpType?: string;
  idpConfig?: Record<string, any> | null;
}

@Injectable()
export class OrganizationService {
  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
  ) {}

  async findAll() {
    return this.prisma.organization.findMany({
      select: {
        id: true, name: true, slug: true, plan: true,
        erpType: true, idpType: true,
        lastSyncAt: true, lastSyncStats: true,
        createdAt: true, updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      select: {
        id: true, name: true, slug: true, plan: true,
        erpType: true, idpType: true,
        lastSyncAt: true, lastSyncStats: true,
        createdAt: true, updatedAt: true,
        // erpConfig / idpConfig NEVER returned raw (encrypted)
      },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async create(data: { name: string; slug: string; plan?: string } & OrgConfigDto) {
    const { name, slug, plan, erpType, erpConfig, idpType, idpConfig } = data;
    return this.prisma.organization.create({
      data: {
        name, slug,
        plan: plan ?? 'BASIC',
        erpType: erpType ?? 'NONE',
        erpConfig: erpConfig ? this.crypto.encryptJson(erpConfig) : null,
        idpType: idpType ?? 'NONE',
        idpConfig: idpConfig ? this.crypto.encryptJson(idpConfig) : null,
      },
    });
  }

  async update(id: string, data: OrgConfigDto & { name?: string; plan?: string }) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');

    const updateData: any = {};
    if (data.name  !== undefined) updateData.name    = data.name;
    if (data.plan  !== undefined) updateData.plan    = data.plan;
    if (data.erpType !== undefined) updateData.erpType = data.erpType;
    if (data.idpType !== undefined) updateData.idpType = data.idpType;

    if (data.erpConfig !== undefined) {
      updateData.erpConfig = data.erpConfig ? this.crypto.encryptJson(data.erpConfig) : null;
    }
    if (data.idpConfig !== undefined) {
      updateData.idpConfig = data.idpConfig ? this.crypto.encryptJson(data.idpConfig) : null;
    }

    return this.prisma.organization.update({ where: { id }, data: updateData });
  }
}

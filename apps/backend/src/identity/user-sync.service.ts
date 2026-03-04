import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { IdentityAdapterFactory } from './adapters/identity-adapter.factory';
import { IIdentityEmployee } from './adapters/identity-adapter.interface';
import * as bcrypt from 'bcrypt';

export interface SyncStats {
  total: number;
  created: number;
  updated: number;
  deactivated: number;
  skipped: number;
  errors: string[];
  syncedAt: string;
}

@Injectable()
export class UserSyncService {
  private readonly logger = new Logger(UserSyncService.name);

  constructor(
    private prisma: PrismaService,
    private adapterFactory: IdentityAdapterFactory,
  ) {}

  // ─── Gece 01:00 otomatik sync (tüm org'lar) ────────────────────────────
  @Cron('0 1 * * *')
  async syncAllOrganizations() {
    this.logger.log('Starting scheduled identity sync for all organizations');

    // Env tabanlı (single-tenant) sync
    if (process.env.IDENTITY_PROVIDER && process.env.IDENTITY_PROVIDER !== 'NONE') {
      await this.syncForEnv();
    }

    // Multi-tenant: IDP yapılandırılmış org'ları sync et
    const orgs = await this.prisma.organization.findMany({
      where: { idpType: { not: 'NONE' } },
    });

    for (const org of orgs) {
      try {
        await this.syncForOrg(org.id);
      } catch (err) {
        this.logger.error(`Sync failed for org ${org.id}: ${(err as Error).message}`);
      }
    }
  }

  // ─── Env tabanlı sync (single-tenant) ─────────────────────────────────
  async syncForEnv(): Promise<SyncStats> {
    const adapter = this.adapterFactory.createFromEnv();
    const employees = await adapter.syncUsers();
    return this.applySync(employees, null, 'ENV');
  }

  // ─── Org tabanlı sync (multi-tenant) ──────────────────────────────────
  async syncForOrg(orgId: string): Promise<SyncStats> {
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    const adapter = this.adapterFactory.createForOrg(org);
    const employees = await adapter.syncUsers();
    const stats = await this.applySync(employees, orgId, org.idpType);

    // Org'a sync sonucunu kaydet
    await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        lastSyncAt: new Date(),
        lastSyncStats: stats as any,
      },
    });

    return stats;
  }

  async testConnection(orgId?: string) {
    if (orgId) {
      const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
      return this.adapterFactory.createForOrg(org).testConnection();
    }
    return this.adapterFactory.createFromEnv().testConnection();
  }

  // ─── Sync algoritması ──────────────────────────────────────────────────
  private async applySync(
    employees: IIdentityEmployee[],
    orgId: string | null,
    source: string,
  ): Promise<SyncStats> {
    const stats: SyncStats = {
      total: employees.length,
      created: 0,
      updated: 0,
      deactivated: 0,
      skipped: 0,
      errors: [],
      syncedAt: new Date().toISOString(),
    };

    this.logger.log(`Syncing ${employees.length} employees from ${source} (org: ${orgId ?? 'env'})`);

    // Pass 1: Upsert users
    const syncedExternalIds: string[] = [];

    for (const emp of employees) {
      try {
        if (!emp.email || !emp.externalId) {
          stats.skipped++;
          continue;
        }

        syncedExternalIds.push(emp.externalId);

        // Email veya externalId ile mevcut kullanıcıyı bul
        const existing = await this.prisma.user.findFirst({
          where: {
            OR: [
              { email: emp.email },
              { externalId: emp.externalId },
            ],
            ...(orgId ? { organizationId: orgId } : {}),
          },
        });

        if (existing) {
          // Güncelle — şifre ve role dokunma (manuel yönetilir)
          await this.prisma.user.update({
            where: { id: existing.id },
            data: {
              name:           emp.name,
              department:     emp.department ?? existing.department,
              externalId:     emp.externalId,
              externalSource: source,
              sapEmployeeId:  emp.sapEmployeeId ?? existing.sapEmployeeId,
              isActive:       emp.isActive,
              lastSyncedAt:   new Date(),
              ...(orgId ? { organizationId: orgId } : {}),
            },
          });
          stats.updated++;
          if (!emp.isActive) stats.deactivated++;
        } else {
          // Yeni kullanıcı oluştur (onaylı, email confirmed, random şifre)
          const tempPassword = await bcrypt.hash(
            require('crypto').randomBytes(32).toString('hex'),
            10,
          );
          await this.prisma.user.create({
            data: {
              name:             emp.name,
              email:            emp.email,
              password:         tempPassword,
              department:       emp.department,
              externalId:       emp.externalId,
              externalSource:   source,
              sapEmployeeId:    emp.sapEmployeeId,
              isApproved:       true,
              isEmailConfirmed: true,
              isActive:         emp.isActive,
              lastSyncedAt:     new Date(),
              ...(orgId ? { organizationId: orgId } : {}),
            },
          });
          stats.created++;
        }
      } catch (err) {
        const msg = `Error syncing ${emp.email}: ${(err as Error).message}`;
        stats.errors.push(msg);
        this.logger.warn(msg);
      }
    }

    // Pass 2: Manager hiyerarşisi
    for (const emp of employees) {
      if (!emp.managerExternalId || !emp.externalId) continue;
      try {
        const user    = await this.prisma.user.findFirst({ where: { externalId: emp.externalId } });
        const manager = await this.prisma.user.findFirst({ where: { externalId: emp.managerExternalId } });
        if (user && manager && user.managerId !== manager.id) {
          await this.prisma.user.update({
            where: { id: user.id },
            data:  { managerId: manager.id },
          });
        }
      } catch (_) {}
    }

    // AuditLog
    await this.prisma.auditLog.create({
      data: {
        userId:   await this.getSystemUserId(),
        action:   'IDENTITY_SYNC',
        details: JSON.stringify({
          source,
          orgId: orgId ?? 'env',
          created:     stats.created,
          updated:     stats.updated,
          deactivated: stats.deactivated,
          skipped:     stats.skipped,
          total:       stats.total,
          errors:      stats.errors.length,
        }),
      },
    });

    this.logger.log(
      `Sync complete [${source}]: ${stats.created} created, ${stats.updated} updated, ${stats.deactivated} deactivated`,
    );

    return stats;
  }

  private async getSystemUserId(): Promise<string> {
    const admin = await this.prisma.user.findFirst({
      where: { role: 'ADMIN' },
      orderBy: { createdAt: 'asc' },
    });
    return admin?.id ?? 'system';
  }
}

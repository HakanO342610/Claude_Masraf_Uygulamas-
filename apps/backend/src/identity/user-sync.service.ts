import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { IdentityAdapterFactory } from './adapters/identity-adapter.factory';
import { IIdentityEmployee, IOrgUnit, IPosition } from './adapters/identity-adapter.interface';
import * as bcrypt from 'bcrypt';

export interface SyncStats {
  total: number;
  created: number;
  updated: number;
  deactivated: number;
  skipped: number;
  departments: { synced: number; created: number; updated: number };
  positions: { synced: number; created: number; updated: number };
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

    // Departman + Pozisyon sync (adapter destekliyorsa)
    const orgUnits = adapter.syncOrgUnits ? await adapter.syncOrgUnits() : [];
    const positions = adapter.syncPositions ? await adapter.syncPositions() : [];
    const deptStats = await this.syncDepartments(orgUnits, null);
    const posStats = await this.syncPositionRecords(positions, null);

    // User sync
    const employees = await adapter.syncUsers();
    return this.applySync(employees, null, 'ENV', deptStats, posStats);
  }

  // ─── Org tabanlı sync (multi-tenant) ──────────────────────────────────
  async syncForOrg(orgId: string): Promise<SyncStats> {
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    const adapter = this.adapterFactory.createForOrg(org);

    // Departman + Pozisyon sync (adapter destekliyorsa)
    const orgUnits = adapter.syncOrgUnits ? await adapter.syncOrgUnits() : [];
    const positions = adapter.syncPositions ? await adapter.syncPositions() : [];
    const deptStats = await this.syncDepartments(orgUnits, orgId);
    const posStats = await this.syncPositionRecords(positions, orgId);

    // User sync
    const employees = await adapter.syncUsers();
    const stats = await this.applySync(employees, orgId, org.idpType, deptStats, posStats);

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

  // ─── Departman Sync ──────────────────────────────────────────────────
  private async syncDepartments(
    orgUnits: IOrgUnit[],
    orgId: string | null,
  ): Promise<{ synced: number; created: number; updated: number }> {
    const result = { synced: orgUnits.length, created: 0, updated: 0 };
    if (!orgUnits.length) return result;

    this.logger.log(`Syncing ${orgUnits.length} departments (org: ${orgId ?? 'env'})`);

    // Pass 1: Upsert departments (parent olmadan)
    for (const ou of orgUnits) {
      if (!ou.code) continue;
      try {
        const existing = await this.prisma.department.findFirst({
          where: {
            code: ou.code,
            organizationId: orgId ?? undefined,
          },
        });

        if (existing) {
          await this.prisma.department.update({
            where: { id: existing.id },
            data: {
              name: ou.name || existing.name,
              externalId: ou.externalId,
              level: ou.level ?? existing.level,
            },
          });
          result.updated++;
        } else {
          await this.prisma.department.create({
            data: {
              name: ou.name || ou.code,
              code: ou.code,
              externalId: ou.externalId,
              level: ou.level ?? 0,
              isActive: true,
              ...(orgId ? { organizationId: orgId } : {}),
            },
          });
          result.created++;
        }
      } catch (err: any) {
        this.logger.warn(`Dept sync error (${ou.code}): ${err.message}`);
      }
    }

    // Pass 2: Parent ilişkilerini kur
    for (const ou of orgUnits) {
      if (!ou.parentExternalId || !ou.code) continue;
      try {
        const dept = await this.prisma.department.findFirst({
          where: { code: ou.code, organizationId: orgId ?? undefined },
        });
        const parent = await this.prisma.department.findFirst({
          where: {
            OR: [
              { externalId: ou.parentExternalId, organizationId: orgId ?? undefined },
              { code: ou.parentExternalId, organizationId: orgId ?? undefined },
            ],
          },
        });
        if (dept && parent && dept.parentId !== parent.id) {
          await this.prisma.department.update({
            where: { id: dept.id },
            data: { parentId: parent.id },
          });
        }
      } catch {}
    }

    // Pass 3: Manager ilişkilerini kur
    for (const ou of orgUnits) {
      if (!ou.code) continue;
      const mgrRef = ou.managerExternalId || ou.managerEmail;
      if (!mgrRef) continue;
      try {
        const dept = await this.prisma.department.findFirst({
          where: { code: ou.code, organizationId: orgId ?? undefined },
        });
        if (!dept) continue;

        const manager = ou.managerEmail
          ? await this.prisma.user.findFirst({ where: { email: ou.managerEmail.toLowerCase() } })
          : await this.prisma.user.findFirst({ where: { externalId: ou.managerExternalId! } });

        if (manager && dept.managerId !== manager.id) {
          await this.prisma.department.update({
            where: { id: dept.id },
            data: { managerId: manager.id },
          });
        }
      } catch {}
    }

    this.logger.log(`Dept sync done: ${result.created} created, ${result.updated} updated`);
    return result;
  }

  // ─── Pozisyon Sync ─────────────────────────────────────────────────────
  private async syncPositionRecords(
    positions: IPosition[],
    orgId: string | null,
  ): Promise<{ synced: number; created: number; updated: number }> {
    const result = { synced: positions.length, created: 0, updated: 0 };
    if (!positions.length) return result;

    this.logger.log(`Syncing ${positions.length} positions (org: ${orgId ?? 'env'})`);

    // Pass 1: Upsert positions
    for (const pos of positions) {
      if (!pos.code) continue;
      try {
        const existing = await this.prisma.position.findFirst({
          where: {
            code: pos.code,
            organizationId: orgId ?? undefined,
          },
        });

        // departmentId çözümle
        let departmentId: string | undefined;
        if (pos.orgUnitExternalId) {
          const dept = await this.prisma.department.findFirst({
            where: {
              OR: [
                { externalId: pos.orgUnitExternalId, organizationId: orgId ?? undefined },
                { code: pos.orgUnitExternalId, organizationId: orgId ?? undefined },
              ],
            },
          });
          departmentId = dept?.id;
        }

        if (existing) {
          await this.prisma.position.update({
            where: { id: existing.id },
            data: {
              title: pos.title || existing.title,
              externalId: pos.externalId,
              level: pos.level ?? existing.level,
              ...(departmentId ? { departmentId } : {}),
            },
          });
          result.updated++;
        } else {
          await this.prisma.position.create({
            data: {
              title: pos.title || pos.code,
              code: pos.code,
              externalId: pos.externalId,
              level: pos.level ?? 0,
              isActive: true,
              ...(departmentId ? { departmentId } : {}),
              ...(orgId ? { organizationId: orgId } : {}),
            },
          });
          result.created++;
        }
      } catch (err: any) {
        this.logger.warn(`Position sync error (${pos.code}): ${err.message}`);
      }
    }

    // Pass 2: Parent pozisyon ilişkilerini kur
    for (const pos of positions) {
      if (!pos.parentPositionExternalId || !pos.code) continue;
      try {
        const position = await this.prisma.position.findFirst({
          where: { code: pos.code, organizationId: orgId ?? undefined },
        });
        const parent = await this.prisma.position.findFirst({
          where: {
            OR: [
              { externalId: pos.parentPositionExternalId, organizationId: orgId ?? undefined },
              { code: pos.parentPositionExternalId, organizationId: orgId ?? undefined },
            ],
          },
        });
        if (position && parent && position.parentPositionId !== parent.id) {
          await this.prisma.position.update({
            where: { id: position.id },
            data: { parentPositionId: parent.id },
          });
        }
      } catch {}
    }

    this.logger.log(`Position sync done: ${result.created} created, ${result.updated} updated`);
    return result;
  }

  // ─── User Sync algoritması ──────────────────────────────────────────────
  private async applySync(
    employees: IIdentityEmployee[],
    orgId: string | null,
    source: string,
    deptStats: { synced: number; created: number; updated: number } = { synced: 0, created: 0, updated: 0 },
    posStats: { synced: number; created: number; updated: number } = { synced: 0, created: 0, updated: 0 },
  ): Promise<SyncStats> {
    const stats: SyncStats = {
      total: employees.length,
      created: 0,
      updated: 0,
      deactivated: 0,
      skipped: 0,
      departments: deptStats,
      positions: posStats,
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
        const normalizedEmail = emp.email.toLowerCase().trim();

        // departmentId çözümle (departmentCode → Department tablosu)
        let departmentId: string | undefined;
        if (emp.departmentCode) {
          const dept = await this.prisma.department.findFirst({
            where: {
              OR: [
                { code: emp.departmentCode, organizationId: orgId ?? undefined },
                { externalId: emp.departmentCode, organizationId: orgId ?? undefined },
              ],
            },
          });
          departmentId = dept?.id;
        }

        // positionId çözümle (positionCode → Position tablosu)
        let positionId: string | undefined;
        if (emp.positionCode) {
          const pos = await this.prisma.position.findFirst({
            where: {
              OR: [
                { code: emp.positionCode, organizationId: orgId ?? undefined },
                { externalId: emp.positionCode, organizationId: orgId ?? undefined },
              ],
            },
          });
          positionId = pos?.id;
        }

        // Email veya externalId ile mevcut kullanıcıyı bul
        const existing = await this.prisma.user.findFirst({
          where: {
            OR: [
              { email: normalizedEmail },
              { externalId: emp.externalId },
            ],
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
              jobTitle:       emp.jobTitle ?? existing.jobTitle,
              ...(departmentId ? { departmentId } : {}),
              ...(positionId ? { positionId } : {}),
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
              email:            normalizedEmail,
              password:         tempPassword,
              department:       emp.department,
              externalId:       emp.externalId,
              externalSource:   source,
              sapEmployeeId:    emp.sapEmployeeId,
              isApproved:       true,
              isEmailConfirmed: true,
              isActive:         emp.isActive,
              lastSyncedAt:     new Date(),
              jobTitle:         emp.jobTitle,
              ...(departmentId ? { departmentId } : {}),
              ...(positionId ? { positionId } : {}),
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

    // Pass 2: Manager hiyerarşisi + Üst Yönetici
    // SAP HCM → managerEmail kullanır (MANAGEREMAIL alanı)
    // Azure AD / LDAP → managerExternalId kullanır
    for (const emp of employees) {
      if (!emp.externalId) continue;
      const hasManagerRef = emp.managerEmail || emp.managerExternalId;
      if (!hasManagerRef) continue;
      try {
        const user = await this.prisma.user.findFirst({ where: { externalId: emp.externalId } });
        if (!user) continue;

        const manager = emp.managerEmail
          ? await this.prisma.user.findFirst({ where: { email: emp.managerEmail } })
          : await this.prisma.user.findFirst({ where: { externalId: emp.managerExternalId! } });

        const updateData: any = {};

        if (manager && user.managerId !== manager.id) {
          updateData.managerId = manager.id;
        }

        // Üst Yönetici (skip-level): emp.upperManagerEmail veya emp.upperManagerExternalId
        if (emp.upperManagerEmail || emp.upperManagerExternalId) {
          const upperMgr = emp.upperManagerEmail
            ? await this.prisma.user.findFirst({ where: { email: emp.upperManagerEmail } })
            : await this.prisma.user.findFirst({ where: { externalId: emp.upperManagerExternalId! } });
          if (upperMgr && user.upperManagerId !== upperMgr.id) {
            updateData.upperManagerId = upperMgr.id;
          }
        } else if (manager) {
          // Üst yönetici bilgisi yoksa, manager'ın manager'ını üst yönetici yap
          if (manager.managerId && user.upperManagerId !== manager.managerId) {
            updateData.upperManagerId = manager.managerId;
          }
        }

        if (Object.keys(updateData).length > 0) {
          await this.prisma.user.update({ where: { id: user.id }, data: updateData });
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
          departments: stats.departments,
          positions:   stats.positions,
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

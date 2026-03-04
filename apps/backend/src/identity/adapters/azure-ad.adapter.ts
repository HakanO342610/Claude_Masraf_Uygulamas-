import { Logger } from '@nestjs/common';
import axios from 'axios';
import { IIdentityAdapter, IIdentityEmployee, IOrgUnit } from './identity-adapter.interface';

export class AzureAdAdapter implements IIdentityAdapter {
  private readonly logger = new Logger(AzureAdAdapter.name);
  private readonly tenantId: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(config: { tenantId: string; clientId: string; clientSecret: string }) {
    this.tenantId    = config.tenantId;
    this.clientId    = config.clientId;
    this.clientSecret = config.clientSecret;
  }

  private async getToken(): Promise<string> {
    const res = await axios.post(
      `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`,
      new URLSearchParams({
        grant_type:    'client_credentials',
        client_id:     this.clientId,
        client_secret: this.clientSecret,
        scope:         'https://graph.microsoft.com/.default',
      }),
    );
    return res.data.access_token;
  }

  async syncUsers(): Promise<IIdentityEmployee[]> {
    const token = await this.getToken();
    const employees: IIdentityEmployee[] = [];
    let url = 'https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,department,jobTitle,accountEnabled,manager&$expand=manager($select=id)&$top=999';

    while (url) {
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      for (const u of res.data.value ?? []) {
        if (!u.mail) continue;
        employees.push({
          externalId:        u.id,
          name:              u.displayName || u.mail,
          email:             u.mail.toLowerCase(),
          department:        u.department || undefined,
          jobTitle:          u.jobTitle   || undefined,
          managerExternalId: u.manager?.id || undefined,
          isActive:          u.accountEnabled !== false,
        });
      }
      url = res.data['@odata.nextLink'] || null;
    }
    return employees;
  }

  async testConnection() {
    try {
      await this.getToken();
      return { connected: true, systemInfo: `Azure AD tenant: ${this.tenantId}` };
    } catch (err: any) {
      return { connected: false, error: err.message };
    }
  }

  // ─── Azure AD Gruplar/Departmanlar ───────────────────────────────────
  async syncOrgUnits(): Promise<IOrgUnit[]> {
    const token = await this.getToken();
    const orgUnits: IOrgUnit[] = [];

    // Azure AD'de departmanlar user.department olarak gelir (flat)
    // Burada unique departmanları çıkarıp org unit olarak döneriz
    const deptSet = new Map<string, { name: string; count: number }>();
    let url = 'https://graph.microsoft.com/v1.0/users?$select=department&$top=999';

    while (url) {
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      for (const u of res.data.value ?? []) {
        if (u.department) {
          const existing = deptSet.get(u.department);
          if (existing) {
            existing.count++;
          } else {
            deptSet.set(u.department, { name: u.department, count: 1 });
          }
        }
      }
      url = res.data['@odata.nextLink'] || null;
    }

    for (const [dept, info] of deptSet) {
      orgUnits.push({
        externalId: dept,
        name: dept,
        code: dept,
      });
    }

    return orgUnits;
  }
}

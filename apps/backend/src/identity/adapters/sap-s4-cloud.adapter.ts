import { Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import {
  IIdentityAdapter,
  IIdentityEmployee,
  IOrgUnit,
  IPosition,
} from './identity-adapter.interface';

/**
 * SAP S/4HANA Cloud / Rise with SAP (SuccessFactors) Adapter
 *
 * SuccessFactors OData V2 API'leri üzerinden kullanıcı, departman, pozisyon çeker.
 *
 * Kullanılan API'ler:
 * - /odata/v2/User                → Çalışanlar
 * - /odata/v2/EmpEmployment       → İstihdam bilgileri (yönetici, pozisyon)
 * - /odata/v2/FODepartment        → Departmanlar (Foundation Objects)
 * - /odata/v2/Position            → Pozisyonlar
 *
 * Auth: OAuth2 (SAML Bearer Assertion veya Client Credentials)
 * Base URL: https://<tenant>.successfactors.com
 */
export class SapS4CloudAdapter implements IIdentityAdapter {
  private readonly logger = new Logger(SapS4CloudAdapter.name);
  private readonly client: AxiosInstance;
  private readonly baseUrl: string;
  private readonly companyId: string;

  // OAuth2 bilgileri
  private readonly tokenUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly apiKey?: string;
  private accessToken?: string;
  private tokenExpiresAt = 0;

  constructor(config: {
    url: string;                 // https://<tenant>.successfactors.com
    companyId: string;           // SF şirket ID'si
    tokenUrl?: string;           // OAuth2 token endpoint
    clientId: string;
    clientSecret: string;
    apiKey?: string;             // SAP API Business Hub key (opsiyonel)
    username?: string;           // Basic auth fallback
    password?: string;
  }) {
    this.baseUrl = config.url.replace(/\/$/, '');
    this.companyId = config.companyId;
    this.tokenUrl = config.tokenUrl || `${this.baseUrl}/oauth/token`;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.apiKey = config.apiKey;

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 60_000,
      headers: {
        Accept: 'application/json',
        ...(config.apiKey ? { 'APIKey': config.apiKey } : {}),
      },
      // Basic auth fallback (bazı SF kurulumları için)
      ...(config.username && config.password
        ? { auth: { username: config.username, password: config.password } }
        : {}),
    });

    // Request interceptor: OAuth2 token ekleme
    this.client.interceptors.request.use(async (reqConfig) => {
      if (this.clientId && this.clientSecret) {
        const token = await this.getAccessToken();
        if (token) {
          reqConfig.headers.Authorization = `Bearer ${token}`;
        }
      }
      return reqConfig;
    });
  }

  // ─── OAuth2 Token ──────────────────────────────────────────────────────
  private async getAccessToken(): Promise<string | null> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60_000) {
      return this.accessToken;
    }

    try {
      const res = await axios.post(
        this.tokenUrl,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          company_id: this.companyId,
        }),
        { timeout: 10_000 },
      );

      this.accessToken = res.data.access_token;
      this.tokenExpiresAt = Date.now() + (res.data.expires_in ?? 3600) * 1000;
      return this.accessToken!;
    } catch (err: any) {
      this.logger.error(`SuccessFactors OAuth2 token alma hatası: ${err.message}`);
      return null;
    }
  }

  // ─── Çalışan Listesi ───────────────────────────────────────────────────
  async syncUsers(): Promise<IIdentityEmployee[]> {
    this.logger.log('SuccessFactors user sync starting...');
    const employees: IIdentityEmployee[] = [];

    let url = `/odata/v2/User?$select=userId,firstName,lastName,email,department,division,title,status,manager/userId,hr/emplStatus&$expand=manager,hr&$top=1000&$format=json`;
    let hasMore = true;

    while (hasMore) {
      const res = await this.client.get(url);
      const results = res.data?.d?.results ?? [];

      for (const user of results) {
        const email = String(user.email || '').trim().toLowerCase();
        if (!email) continue;

        const firstName = String(user.firstName || '').trim();
        const lastName = String(user.lastName || '').trim();
        const isActive = this.isUserActive(user);

        employees.push({
          externalId: String(user.userId || '').trim(),
          name: [firstName, lastName].filter(Boolean).join(' ') || email,
          email,
          department: user.department || undefined,
          departmentCode: user.department || undefined,
          jobTitle: user.title || undefined,
          positionCode: user.position || undefined,
          managerExternalId: user.manager?.userId || undefined,
          sapEmployeeId: String(user.userId || '').trim(),
          isActive,
        });
      }

      // OData paging
      const nextLink = res.data?.d?.__next;
      if (nextLink) {
        url = nextLink;
      } else {
        hasMore = false;
      }
    }

    this.logger.log(`SuccessFactors returned ${employees.length} employees`);
    return employees;
  }

  // ─── Organizasyon Birimleri (FODepartment) ─────────────────────────────
  async syncOrgUnits(): Promise<IOrgUnit[]> {
    this.logger.log('SuccessFactors department sync starting...');
    const orgUnits: IOrgUnit[] = [];

    let url = `/odata/v2/FODepartment?$select=externalCode,name,parent,headOfUnit,description&$top=5000&$format=json`;
    let hasMore = true;

    while (hasMore) {
      const res = await this.client.get(url);
      const results = res.data?.d?.results ?? [];

      for (const dept of results) {
        // name alanı localized olabilir — defaultValue veya direkt string
        const name = typeof dept.name === 'string'
          ? dept.name
          : dept.name?.defaultValue || dept.name?.value || dept.description || dept.externalCode;

        orgUnits.push({
          externalId: String(dept.externalCode || '').trim(),
          name: String(name || '').trim(),
          code: String(dept.externalCode || '').trim(),
          parentExternalId: dept.parent || undefined,
          managerExternalId: dept.headOfUnit || undefined,
        });
      }

      const nextLink = res.data?.d?.__next;
      hasMore = !!nextLink;
      if (nextLink) url = nextLink;
    }

    this.logger.log(`SuccessFactors returned ${orgUnits.length} departments`);
    return orgUnits;
  }

  // ─── Pozisyonlar ───────────────────────────────────────────────────────
  async syncPositions(): Promise<IPosition[]> {
    this.logger.log('SuccessFactors position sync starting...');
    const positions: IPosition[] = [];

    let url = `/odata/v2/Position?$select=code,externalName_defaultValue,department,parentPosition&$top=5000&$format=json`;
    let hasMore = true;

    while (hasMore) {
      const res = await this.client.get(url);
      const results = res.data?.d?.results ?? [];

      for (const pos of results) {
        const title = pos.externalName_defaultValue
          || pos.externalName?.defaultValue
          || pos.name || pos.code;

        positions.push({
          externalId: String(pos.code || '').trim(),
          title: String(title || '').trim(),
          code: String(pos.code || '').trim(),
          orgUnitExternalId: pos.department || undefined,
          parentPositionExternalId: pos.parentPosition || undefined,
        });
      }

      const nextLink = res.data?.d?.__next;
      hasMore = !!nextLink;
      if (nextLink) url = nextLink;
    }

    this.logger.log(`SuccessFactors returned ${positions.length} positions`);
    return positions;
  }

  // ─── Bağlantı Testi ────────────────────────────────────────────────────
  async testConnection() {
    try {
      // Basit bir User sorgusu ile bağlantı testi
      const res = await this.client.get(
        '/odata/v2/User?$top=1&$select=userId&$format=json',
        { timeout: 10_000, validateStatus: () => true },
      );

      if (res.status === 200) {
        const count = res.data?.d?.results?.length ?? '?';
        return {
          connected: true,
          systemInfo: `SuccessFactors @ ${this.baseUrl} — Company: ${this.companyId}`,
        };
      }

      if (res.status === 401 || res.status === 403) {
        return {
          connected: false,
          error: `SuccessFactors erişilebilir ama yetkilendirme hatası (HTTP ${res.status}). OAuth2 ayarlarını kontrol edin.`,
        };
      }

      return { connected: false, error: `HTTP ${res.status}` };
    } catch (err: any) {
      return { connected: false, error: err.message };
    }
  }

  // ─── Yardımcı ──────────────────────────────────────────────────────────
  private isUserActive(user: any): boolean {
    // SuccessFactors status kontrolü
    const status = String(user.status || '').toLowerCase();
    if (status === 'inactive' || status === 'terminated') return false;

    // HR employment status
    const emplStatus = user.hr?.emplStatus || user.emplStatus;
    if (emplStatus === 'T' || emplStatus === 'I') return false; // Terminated / Inactive

    return true;
  }
}

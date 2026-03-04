import { Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import {
  IIdentityAdapter,
  IIdentityEmployee,
  IOrgUnit,
} from './identity-adapter.interface';

/**
 * External Database / REST API Adapter
 *
 * Herhangi bir harici HR sistemi, REST API veya veritabanı view'ından
 * kullanıcı ve organizasyon bilgilerini çeker.
 *
 * İki mod desteklenir:
 * 1. REST API: Belirli endpoint'lere GET request
 * 2. Database View: PostgreSQL/MySQL bağlantısı (connection string ile)
 *
 * REST API Beklenen Format:
 * GET /users → { "data": [ { "id": "...", "name": "...", "email": "...", ... } ] }
 * GET /departments → { "data": [ { "id": "...", "name": "...", "code": "...", ... } ] }
 *
 * Field Mapping: config.fieldMap ile alan adları özelleştirilebilir
 */
export class ExternalDbAdapter implements IIdentityAdapter {
  private readonly logger = new Logger(ExternalDbAdapter.name);
  private readonly client: AxiosInstance;
  private readonly mode: 'REST' | 'DB';
  private readonly baseUrl: string;
  private readonly usersEndpoint: string;
  private readonly departmentsEndpoint: string;
  private readonly fieldMap: Record<string, string>;
  private readonly dbConnectionString?: string;
  private readonly dbUserQuery?: string;
  private readonly dbDeptQuery?: string;

  constructor(config: {
    mode?: 'REST' | 'DB';
    // REST modu
    url?: string;
    apiKey?: string;
    bearerToken?: string;
    username?: string;
    password?: string;
    usersEndpoint?: string;
    departmentsEndpoint?: string;
    fieldMap?: Record<string, string>;
    // DB modu
    dbConnectionString?: string;
    dbUserQuery?: string;
    dbDeptQuery?: string;
  }) {
    this.mode = config.mode || 'REST';
    this.baseUrl = (config.url || '').replace(/\/$/, '');
    this.usersEndpoint = config.usersEndpoint || '/users';
    this.departmentsEndpoint = config.departmentsEndpoint || '/departments';
    this.dbConnectionString = config.dbConnectionString;
    this.dbUserQuery = config.dbUserQuery;
    this.dbDeptQuery = config.dbDeptQuery;

    // Varsayılan alan eşleştirmesi (kaynaktaki alan adı → bizim alan adımız)
    this.fieldMap = {
      id: 'id',
      externalId: 'externalId',
      name: 'name',
      firstName: 'firstName',
      lastName: 'lastName',
      email: 'email',
      department: 'department',
      departmentCode: 'departmentCode',
      jobTitle: 'jobTitle',
      title: 'title',
      managerId: 'managerId',
      managerEmail: 'managerEmail',
      employeeId: 'employeeId',
      isActive: 'isActive',
      status: 'status',
      // Department fields
      deptId: 'id',
      deptName: 'name',
      deptCode: 'code',
      deptParentId: 'parentId',
      deptManagerId: 'managerId',
      ...config.fieldMap,
    };

    // HTTP client
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (config.apiKey) headers['X-API-Key'] = config.apiKey;
    if (config.bearerToken) headers.Authorization = `Bearer ${config.bearerToken}`;

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers,
      auth: config.username && config.password
        ? { username: config.username, password: config.password }
        : undefined,
      timeout: 30_000,
    });
  }

  // ─── Çalışan Listesi ───────────────────────────────────────────────────
  async syncUsers(): Promise<IIdentityEmployee[]> {
    if (this.mode === 'DB') {
      return this.syncUsersFromDb();
    }

    this.logger.log(`External REST user sync: GET ${this.baseUrl}${this.usersEndpoint}`);

    const employees: IIdentityEmployee[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const separator = this.usersEndpoint.includes('?') ? '&' : '?';
      const url = `${this.usersEndpoint}${separator}page=${page}&limit=1000`;
      const res = await this.client.get(url);

      // Esnek response parsing: data[], results[], items[], veya direkt array
      const items = res.data?.data ?? res.data?.results ?? res.data?.items ?? (Array.isArray(res.data) ? res.data : []);

      if (!items.length) {
        hasMore = false;
        break;
      }

      for (const raw of items) {
        const emp = this.mapUserFields(raw);
        if (emp.externalId && emp.email) {
          employees.push(emp);
        }
      }

      // Sayfalama kontrolü
      const totalPages = res.data?.totalPages ?? res.data?.meta?.totalPages;
      if (totalPages && page >= totalPages) {
        hasMore = false;
      } else if (items.length < 1000) {
        hasMore = false;
      } else {
        page++;
      }
    }

    this.logger.log(`External REST returned ${employees.length} employees`);
    return employees;
  }

  /** DB modunda çalışan çekme */
  private async syncUsersFromDb(): Promise<IIdentityEmployee[]> {
    if (!this.dbConnectionString || !this.dbUserQuery) {
      throw new Error('DB modu için dbConnectionString ve dbUserQuery gereklidir');
    }

    this.logger.log('External DB user sync starting...');

    // Dinamik pg import
    let pg: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      pg = require('pg');
    } catch {
      throw new Error('pg paketi kurulu değil. Kurmak için: npm install pg');
    }

    const client = new pg.Client({ connectionString: this.dbConnectionString });
    try {
      await client.connect();
      const result = await client.query(this.dbUserQuery);
      const rows = result.rows ?? [];

      this.logger.log(`External DB returned ${rows.length} user rows`);

      return rows
        .map((raw: any) => this.mapUserFields(raw))
        .filter((e: IIdentityEmployee) => e.externalId && e.email);
    } finally {
      await client.end();
    }
  }

  // ─── Organizasyon Birimleri ─────────────────────────────────────────────
  async syncOrgUnits(): Promise<IOrgUnit[]> {
    if (this.mode === 'DB') {
      return this.syncOrgUnitsFromDb();
    }

    this.logger.log(`External REST department sync: GET ${this.baseUrl}${this.departmentsEndpoint}`);

    const res = await this.client.get(this.departmentsEndpoint);
    const items = res.data?.data ?? res.data?.results ?? res.data?.items ?? (Array.isArray(res.data) ? res.data : []);

    this.logger.log(`External REST returned ${items.length} departments`);

    return items.map((raw: any): IOrgUnit => {
      const fm = this.fieldMap;
      return {
        externalId: String(raw[fm.deptId] || raw.id || '').trim(),
        name: String(raw[fm.deptName] || raw.name || '').trim(),
        code: String(raw[fm.deptCode] || raw.code || raw.id || '').trim(),
        parentExternalId: raw[fm.deptParentId] || raw.parentId || undefined,
        managerExternalId: raw[fm.deptManagerId] || raw.managerId || undefined,
      };
    });
  }

  /** DB modunda departman çekme */
  private async syncOrgUnitsFromDb(): Promise<IOrgUnit[]> {
    if (!this.dbConnectionString || !this.dbDeptQuery) {
      this.logger.warn('DB modu: dbDeptQuery tanımsız — org unit sync atlanıyor');
      return [];
    }

    let pg: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      pg = require('pg');
    } catch {
      throw new Error('pg paketi kurulu değil');
    }

    const client = new pg.Client({ connectionString: this.dbConnectionString });
    try {
      await client.connect();
      const result = await client.query(this.dbDeptQuery);
      const rows = result.rows ?? [];

      return rows.map((raw: any): IOrgUnit => ({
        externalId: String(raw.id || '').trim(),
        name: String(raw.name || '').trim(),
        code: String(raw.code || raw.id || '').trim(),
        parentExternalId: raw.parent_id || raw.parentId || undefined,
        managerExternalId: raw.manager_id || raw.managerId || undefined,
        level: raw.level ?? undefined,
      }));
    } finally {
      await client.end();
    }
  }

  // ─── Bağlantı Testi ────────────────────────────────────────────────────
  async testConnection() {
    try {
      if (this.mode === 'DB') {
        let pg: any;
        try { pg = require('pg'); } catch { return { connected: false, error: 'pg paketi kurulu değil' }; }

        const client = new pg.Client({ connectionString: this.dbConnectionString });
        await client.connect();
        const res = await client.query('SELECT 1');
        await client.end();
        return { connected: true, systemInfo: `External DB bağlantısı başarılı` };
      }

      // REST modu
      const res = await this.client.get(this.usersEndpoint + '?limit=1', {
        timeout: 10_000,
        validateStatus: () => true,
      });

      if (res.status === 200) {
        return { connected: true, systemInfo: `External REST API @ ${this.baseUrl}` };
      }
      return { connected: false, error: `HTTP ${res.status}` };
    } catch (err: any) {
      return { connected: false, error: err.message };
    }
  }

  // ─── Alan Eşleştirme ───────────────────────────────────────────────────
  private mapUserFields(raw: any): IIdentityEmployee {
    const fm = this.fieldMap;

    const firstName = String(raw[fm.firstName] || raw.firstName || raw.first_name || '').trim();
    const lastName = String(raw[fm.lastName] || raw.lastName || raw.last_name || '').trim();
    const directName = String(raw[fm.name] || raw.name || raw.displayName || raw.display_name || '').trim();
    const email = String(raw[fm.email] || raw.email || raw.mail || '').trim().toLowerCase();

    // isActive: boolean, 1/0, "active"/"inactive", "true"/"false"
    let isActive = true;
    const activeField = raw[fm.isActive] ?? raw.isActive ?? raw.is_active ?? raw.active;
    const statusField = raw[fm.status] ?? raw.status;
    if (activeField !== undefined && activeField !== null) {
      isActive = activeField === true || activeField === 1 || activeField === '1'
        || String(activeField).toLowerCase() === 'true';
    } else if (statusField) {
      const s = String(statusField).toLowerCase();
      isActive = s !== 'inactive' && s !== 'terminated' && s !== 'disabled' && s !== '0';
    }

    return {
      externalId: String(raw[fm.externalId] || raw[fm.id] || raw.id || raw.externalId || raw.external_id || '').trim(),
      name: directName || [firstName, lastName].filter(Boolean).join(' ') || email,
      email,
      department: raw[fm.department] || raw.department || raw.dept || undefined,
      departmentCode: raw[fm.departmentCode] || raw.departmentCode || raw.department_code || raw.dept_code || undefined,
      jobTitle: raw[fm.jobTitle] || raw[fm.title] || raw.jobTitle || raw.job_title || raw.title || undefined,
      managerExternalId: raw[fm.managerId] || raw.managerId || raw.manager_id || undefined,
      managerEmail: raw[fm.managerEmail] || raw.managerEmail || raw.manager_email || undefined,
      sapEmployeeId: raw[fm.employeeId] || raw.employeeId || raw.employee_id || raw.sap_id || undefined,
      isActive,
    };
  }
}

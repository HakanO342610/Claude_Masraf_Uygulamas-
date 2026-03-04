import { Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import {
  IIdentityAdapter,
  IIdentityEmployee,
  IOrgUnit,
  IPosition,
} from './identity-adapter.interface';

/**
 * SAP S/4HANA On-Premise Adapter
 *
 * OData V2/V4 API'leri üzerinden kullanıcı, organizasyon birimi ve pozisyon
 * bilgilerini çeker.
 *
 * Kullanılan API'ler:
 * - /sap/opu/odata/sap/API_BUSINESS_PARTNER            → İş ortakları (çalışanlar)
 * - /sap/opu/odata/sap/YY1_ORGSTRUCTURE (Custom CDS)   → Org birimleri
 * - Veya custom SICF service: /sap/bc/masraffco/user_list (ECC uyumlu)
 *
 * S4 HANA'da HR modülü varsa:
 * - /sap/opu/odata/sap/API_WORKFORCE_PERSON_READ        → Çalışanlar (HCM for S4)
 *
 * Auth: Basic Auth veya OAuth2 (SAP Gateway)
 */
export class SapS4OnPremAdapter implements IIdentityAdapter {
  private readonly logger = new Logger(SapS4OnPremAdapter.name);
  private readonly client: AxiosInstance;
  private readonly baseUrl: string;
  private readonly orgStructurePath: string;
  private readonly userListPath: string;
  private readonly positionPath: string;

  constructor(config: {
    url: string;
    username: string;
    password: string;
    oauth2Token?: string;
    userListPath?: string;
    orgStructurePath?: string;
    positionPath?: string;
  }) {
    this.baseUrl = config.url.replace(/\/$/, '');
    this.userListPath = config.userListPath || '/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner';
    this.orgStructurePath = config.orgStructurePath || '/sap/opu/odata/sap/YY1_ORGSTRUCTURE/OrgUnit';
    this.positionPath = config.positionPath || '/sap/opu/odata/sap/YY1_ORGSTRUCTURE/Position';

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (config.oauth2Token) {
      headers.Authorization = `Bearer ${config.oauth2Token}`;
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers,
      auth: config.oauth2Token
        ? undefined
        : { username: config.username, password: config.password },
      timeout: 60_000,
    });
  }

  // ─── Çalışan Listesi ───────────────────────────────────────────────────
  async syncUsers(): Promise<IIdentityEmployee[]> {
    this.logger.log(`S4 HANA user sync: GET ${this.userListPath}`);
    const employees: IIdentityEmployee[] = [];

    try {
      // S4 HANA Business Partner API — Person tipi ($filter=BusinessPartnerCategory eq '1')
      let url = `${this.userListPath}?$filter=BusinessPartnerCategory eq '1'&$select=BusinessPartner,BusinessPartnerFullName,to_BusinessPartnerAddress/EmailAddress&$expand=to_BusinessPartnerAddress&$top=1000&$format=json`;
      let hasMore = true;

      while (hasMore) {
        const res = await this.client.get(url);
        const results = res.data?.d?.results ?? res.data?.value ?? [];

        for (const bp of results) {
          const email = this.extractEmail(bp);
          if (!email) continue;

          employees.push({
            externalId: String(bp.BusinessPartner || '').trim(),
            name: String(bp.BusinessPartnerFullName || bp.BusinessPartner || '').trim(),
            email: email.toLowerCase(),
            department: bp.Department || undefined,
            departmentCode: bp.DepartmentCode || bp.OrganizationBPName1 || undefined,
            jobTitle: bp.JobTitle || undefined,
            positionCode: bp.PositionCode || undefined,
            managerExternalId: bp.ManagerBusinessPartner || undefined,
            sapEmployeeId: String(bp.BusinessPartner || '').trim(),
            isActive: bp.BusinessPartnerIsBlocked !== true,
          });
        }

        // OData paging ($skiptoken veya __next)
        const nextLink = res.data?.d?.__next || res.data?.['@odata.nextLink'];
        if (nextLink) {
          url = nextLink;
        } else {
          hasMore = false;
        }
      }

      this.logger.log(`S4 HANA returned ${employees.length} employees`);
    } catch (err: any) {
      this.logger.error(`S4 HANA user sync failed: ${err.message}`);

      // Fallback: Custom SICF service (ECC uyumlu endpoint)
      this.logger.log('Falling back to custom SICF user_list endpoint...');
      return this.syncUsersViaSicf();
    }

    return employees;
  }

  /** Fallback: ECC uyumlu /sap/bc/masraffco/user_list endpoint'i */
  private async syncUsersViaSicf(): Promise<IIdentityEmployee[]> {
    const url = '/sap/bc/masraffco/user_list';
    const res = await this.client.post(url, null, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const raw: any[] = Array.isArray(res.data?.PERSONS) ? res.data.PERSONS : [];
    return raw
      .map((r): IIdentityEmployee => ({
        externalId: String(r.PERSONNELCODE || '').trim(),
        sapEmployeeId: String(r.PERSONNELCODE || '').trim(),
        name: [String(r.NAME || '').trim(), String(r.SURNAME || '').trim()].filter(Boolean).join(' '),
        email: String(r.EMAIL || '').trim().toLowerCase(),
        department: r.DEPARTMENT ? String(r.DEPARTMENT).trim() : undefined,
        departmentCode: r.DEPARTMENT_CODE || r.ORGEH || undefined,
        jobTitle: r.TITLE ? String(r.TITLE).trim() : undefined,
        positionCode: r.PLANS || undefined,
        managerEmail: r.MANAGEREMAIL ? String(r.MANAGEREMAIL).trim().toLowerCase() : undefined,
        isActive: String(r.ISACTIVE || '').toUpperCase() === 'X',
      }))
      .filter(e => e.externalId && e.email);
  }

  // ─── Organizasyon Birimleri ─────────────────────────────────────────────
  async syncOrgUnits(): Promise<IOrgUnit[]> {
    this.logger.log(`S4 HANA org unit sync: GET ${this.orgStructurePath}`);
    const orgUnits: IOrgUnit[] = [];

    try {
      let url = `${this.orgStructurePath}?$select=OrgUnitID,OrgUnitName,ParentOrgUnitID,ManagerID,HierarchyLevel&$top=5000&$format=json`;
      let hasMore = true;

      while (hasMore) {
        const res = await this.client.get(url);
        const results = res.data?.d?.results ?? res.data?.value ?? [];

        for (const ou of results) {
          orgUnits.push({
            externalId: String(ou.OrgUnitID || ou.Orgeh || '').trim(),
            name: String(ou.OrgUnitName || ou.Orgtx || '').trim(),
            code: String(ou.OrgUnitID || ou.Orgeh || '').trim(),
            parentExternalId: ou.ParentOrgUnitID || ou.UpOrgeh || undefined,
            managerExternalId: ou.ManagerID || ou.ManagerPnr || undefined,
            level: typeof ou.HierarchyLevel === 'number' ? ou.HierarchyLevel : undefined,
          });
        }

        const nextLink = res.data?.d?.__next || res.data?.['@odata.nextLink'];
        hasMore = !!nextLink;
        if (nextLink) url = nextLink;
      }

      this.logger.log(`S4 HANA returned ${orgUnits.length} org units`);
    } catch (err: any) {
      this.logger.warn(`S4 HANA org unit sync failed: ${err.message} — trying SICF fallback`);
      return this.syncOrgUnitsViaSicf();
    }

    return orgUnits;
  }

  /** Fallback: SICF endpoint'inden org unit çekme */
  private async syncOrgUnitsViaSicf(): Promise<IOrgUnit[]> {
    try {
      const res = await this.client.post('/sap/bc/masraffco/user_list', null, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const raw: any[] = Array.isArray(res.data?.ORG_UNITS) ? res.data.ORG_UNITS : [];
      return raw.map((ou): IOrgUnit => ({
        externalId: String(ou.ORGEH || '').trim(),
        name: String(ou.NAME || ou.ORGTX || '').trim(),
        code: String(ou.ORGEH || '').trim(),
        parentExternalId: ou.PARENT_ORGEH || ou.UP_ORGEH || undefined,
        managerExternalId: ou.MANAGER_PNR || undefined,
        level: typeof ou.LEVEL === 'number' ? ou.LEVEL : undefined,
      }));
    } catch {
      return [];
    }
  }

  // ─── Pozisyonlar ───────────────────────────────────────────────────────
  async syncPositions(): Promise<IPosition[]> {
    this.logger.log(`S4 HANA position sync: GET ${this.positionPath}`);
    const positions: IPosition[] = [];

    try {
      let url = `${this.positionPath}?$select=PositionID,PositionName,OrgUnitID,ParentPositionID,HierarchyLevel&$top=5000&$format=json`;
      let hasMore = true;

      while (hasMore) {
        const res = await this.client.get(url);
        const results = res.data?.d?.results ?? res.data?.value ?? [];

        for (const pos of results) {
          positions.push({
            externalId: String(pos.PositionID || pos.Plans || '').trim(),
            title: String(pos.PositionName || pos.Plstx || '').trim(),
            code: String(pos.PositionID || pos.Plans || '').trim(),
            orgUnitExternalId: pos.OrgUnitID || pos.Orgeh || undefined,
            parentPositionExternalId: pos.ParentPositionID || pos.UpPlans || undefined,
            level: typeof pos.HierarchyLevel === 'number' ? pos.HierarchyLevel : undefined,
          });
        }

        const nextLink = res.data?.d?.__next || res.data?.['@odata.nextLink'];
        hasMore = !!nextLink;
        if (nextLink) url = nextLink;
      }

      this.logger.log(`S4 HANA returned ${positions.length} positions`);
    } catch (err: any) {
      this.logger.warn(`S4 HANA position sync failed: ${err.message} — trying SICF fallback`);
      return this.syncPositionsViaSicf();
    }

    return positions;
  }

  /** Fallback: SICF endpoint'inden pozisyon çekme */
  private async syncPositionsViaSicf(): Promise<IPosition[]> {
    try {
      const res = await this.client.post('/sap/bc/masraffco/user_list', null, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const raw: any[] = Array.isArray(res.data?.POSITIONS) ? res.data.POSITIONS : [];
      return raw.map((pos): IPosition => ({
        externalId: String(pos.PLANS || '').trim(),
        title: String(pos.TITLE || pos.PLSTX || '').trim(),
        code: String(pos.PLANS || '').trim(),
        orgUnitExternalId: pos.ORGEH || undefined,
        parentPositionExternalId: pos.PARENT_PLANS || pos.UP_PLANS || undefined,
        level: typeof pos.LEVEL === 'number' ? pos.LEVEL : undefined,
      }));
    } catch {
      return [];
    }
  }

  // ─── Bağlantı Testi ────────────────────────────────────────────────────
  async testConnection() {
    try {
      // OData metadata endpoint'ine GET
      const res = await this.client.get(
        '/sap/opu/odata/sap/API_BUSINESS_PARTNER/$metadata',
        { timeout: 10_000, validateStatus: () => true },
      );

      if (res.status === 200) {
        return { connected: true, systemInfo: `S4 HANA On-Premise @ ${this.baseUrl}` };
      }

      // Fallback: SICF test
      const sicfRes = await this.client.post('/sap/bc/masraffco/user_list', null, {
        timeout: 10_000,
        validateStatus: () => true,
      });
      if (sicfRes.status === 200) {
        return { connected: true, systemInfo: `S4 HANA (SICF fallback) @ ${this.baseUrl}` };
      }

      return { connected: false, error: `HTTP ${res.status}` };
    } catch (err: any) {
      return { connected: false, error: err.message };
    }
  }

  // ─── Yardımcı ──────────────────────────────────────────────────────────
  private extractEmail(bp: any): string | null {
    // to_BusinessPartnerAddress expand'inden email çıkarma
    const addresses = bp.to_BusinessPartnerAddress?.results ?? bp.to_BusinessPartnerAddress ?? [];
    for (const addr of Array.isArray(addresses) ? addresses : [addresses]) {
      if (addr?.EmailAddress) return String(addr.EmailAddress).trim();
    }
    // Direkt alan
    if (bp.EmailAddress) return String(bp.EmailAddress).trim();
    if (bp.Email) return String(bp.Email).trim();
    return null;
  }
}

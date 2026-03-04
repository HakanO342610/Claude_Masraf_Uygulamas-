import { Logger } from '@nestjs/common';
import axios from 'axios';
import { IIdentityAdapter, IIdentityEmployee, IOrgUnit, IPosition } from './identity-adapter.interface';

/**
 * SAP HCM Adapter — MYDMG_GET_USER_LIST metodunu HTTP POST ile çağırır.
 *
 * Endpoint: POST {SAP_URL}/sap/bc/masraffco/user_list
 *
 * Beklenen JSON response — ZMASRAFF_S_PERSONS yapısı:
 * {
 *   "PERSONS": [
 *     {
 *       "PERSONNELCODE": "00012345",   // externalId + sapEmployeeId
 *       "NAME":          "Ali",
 *       "SURNAME":       "Veli",
 *       "EMAIL":         "ali.veli@firma.com",
 *       "DEPARTMENT":    "Bilgi Teknolojileri",
 *       "TITLE":         "Yazılım Geliştirici",
 *       "MANAGEREMAIL":  "manager@firma.com",  // ID değil, e-posta!
 *       "ISACTIVE":      "X"                   // 'X' = aktif, '' = pasif
 *     },
 *     ...
 *   ]
 * }
 */
export class SapHcmAdapter implements IIdentityAdapter {
  private readonly logger = new Logger(SapHcmAdapter.name);

  private readonly baseUrl: string;
  private readonly username: string;
  private readonly password: string;
  private readonly userListPath: string;

  constructor(config: {
    url: string;
    username: string;
    password: string;
    userListPath?: string;
    fieldMap?: Record<string, string>; // reserved for future customization
  }) {
    this.baseUrl     = config.url.replace(/\/$/, '');
    this.username    = config.username;
    this.password    = config.password;
    this.userListPath = config.userListPath || '/sap/bc/masraffco/user_list';
  }

  async syncUsers(): Promise<IIdentityEmployee[]> {
    const url = `${this.baseUrl}${this.userListPath}`;
    this.logger.log(`SAP HCM user sync: POST ${url}`);

    const response = await axios.post(url, null, {
      auth: { username: this.username, password: this.password },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      timeout: 30_000,
    });

    // ZMASRAFF_S_PERSONS: { PERSONS: [...] }
    const raw: any[] = Array.isArray(response.data?.PERSONS)
      ? response.data.PERSONS
      : [];

    this.logger.log(`SAP HCM returned ${raw.length} person records`);

    return raw
      .map((r): IIdentityEmployee => {
        const personnelCode = String(r.PERSONNELCODE || '').trim();
        const firstName     = String(r.NAME    || '').trim();
        const lastName      = String(r.SURNAME || '').trim();
        const email         = String(r.EMAIL   || '').trim().toLowerCase();
        const managerEmail  = String(r.MANAGEREMAIL || '').trim().toLowerCase() || undefined;
        const isActive      = String(r.ISACTIVE || '').toUpperCase() === 'X';

        const upperManagerEmail = String(r.UPPER_MANAGER_EMAIL || '').trim().toLowerCase() || undefined;

        return {
          externalId:         personnelCode,
          sapEmployeeId:      personnelCode,
          name:               [firstName, lastName].filter(Boolean).join(' ') || personnelCode,
          email,
          department:         r.DEPARTMENT ? String(r.DEPARTMENT).trim() : undefined,
          departmentCode:     r.DEPARTMENT_CODE || r.ORGEH || undefined,
          jobTitle:           r.TITLE ? String(r.TITLE).trim() : undefined,
          positionCode:       r.PLANS || r.POSITION_CODE || undefined,
          managerEmail,
          upperManagerEmail,
          isActive,
        };
      })
      .filter(e => e.externalId && e.email); // email ve ID olmayan kayıtları atla
  }

  async testConnection() {
    // user_list endpoint'ine POST atarak bağlantıyı doğrula
    // 200 → bağlı, 401/403 → SAP erişilebilir ama yetki sorunu, diğer → hata
    const url = `${this.baseUrl}${this.userListPath}`;
    try {
      const res = await axios.post(url, null, {
        auth: { username: this.username, password: this.password },
        headers: { Accept: 'application/json' },
        timeout: 10_000,
        validateStatus: () => true, // tüm HTTP kodlarını başarı say, biz handle ederiz
      });
      if (res.status === 200) {
        const count = Array.isArray(res.data?.PERSONS) ? res.data.PERSONS.length : '?';
        return { connected: true, systemInfo: `SAP HCM @ ${this.baseUrl} — ${count} kayıt` };
      }
      if (res.status === 401 || res.status === 403) {
        return { connected: false, error: `SAP erişilebilir ama yetkilendirme hatası (HTTP ${res.status})` };
      }
      return { connected: false, error: `HTTP ${res.status} — endpoint bulunamadı (SICF aktif mi?)` };
    } catch (err: any) {
      return { connected: false, error: err.message };
    }
  }

  // ─── Organizasyon Birimleri (SAP HCM: OM modülü) ─────────────────────
  async syncOrgUnits(): Promise<IOrgUnit[]> {
    const url = `${this.baseUrl}${this.userListPath}`;
    this.logger.log(`SAP HCM org unit sync: POST ${url}`);

    try {
      const response = await axios.post(url, null, {
        auth: { username: this.username, password: this.password },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        timeout: 30_000,
      });

      const raw: any[] = Array.isArray(response.data?.ORG_UNITS)
        ? response.data.ORG_UNITS
        : [];

      this.logger.log(`SAP HCM returned ${raw.length} org unit records`);

      return raw.map((ou): IOrgUnit => ({
        externalId:       String(ou.ORGEH || '').trim(),
        name:             String(ou.NAME || ou.ORGTX || '').trim(),
        code:             String(ou.ORGEH || '').trim(),
        parentExternalId: ou.PARENT_ORGEH || ou.UP_ORGEH || undefined,
        managerExternalId: ou.MANAGER_PNR || undefined,
        managerEmail:     ou.MANAGER_EMAIL || undefined,
        level:            typeof ou.LEVEL === 'number' ? ou.LEVEL : undefined,
      }));
    } catch (err: any) {
      this.logger.warn(`SAP HCM org unit sync failed: ${err.message}`);
      return [];
    }
  }

  // ─── Pozisyonlar (SAP HCM: OM modülü) ────────────────────────────────
  async syncPositions(): Promise<IPosition[]> {
    const url = `${this.baseUrl}${this.userListPath}`;
    this.logger.log(`SAP HCM position sync: POST ${url}`);

    try {
      const response = await axios.post(url, null, {
        auth: { username: this.username, password: this.password },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        timeout: 30_000,
      });

      const raw: any[] = Array.isArray(response.data?.POSITIONS)
        ? response.data.POSITIONS
        : [];

      this.logger.log(`SAP HCM returned ${raw.length} position records`);

      return raw.map((pos): IPosition => ({
        externalId:                String(pos.PLANS || '').trim(),
        title:                     String(pos.TITLE || pos.PLSTX || '').trim(),
        code:                      String(pos.PLANS || '').trim(),
        orgUnitExternalId:         pos.ORGEH || undefined,
        parentPositionExternalId:  pos.PARENT_PLANS || pos.UP_PLANS || undefined,
        level:                     typeof pos.LEVEL === 'number' ? pos.LEVEL : undefined,
      }));
    } catch (err: any) {
      this.logger.warn(`SAP HCM position sync failed: ${err.message}`);
      return [];
    }
  }
}

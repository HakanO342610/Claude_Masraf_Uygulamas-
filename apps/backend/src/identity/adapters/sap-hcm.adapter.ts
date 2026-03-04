import { Logger } from '@nestjs/common';
import axios from 'axios';
import { IIdentityAdapter, IIdentityEmployee } from './identity-adapter.interface';

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

        return {
          externalId:    personnelCode,
          sapEmployeeId: personnelCode,
          name:          [firstName, lastName].filter(Boolean).join(' ') || personnelCode,
          email,
          department:    r.DEPARTMENT ? String(r.DEPARTMENT).trim() : undefined,
          jobTitle:      r.TITLE      ? String(r.TITLE).trim()      : undefined,
          managerEmail,
          isActive,
        };
      })
      .filter(e => e.externalId && e.email); // email ve ID olmayan kayıtları atla
  }

  async testConnection() {
    try {
      const url = `${this.baseUrl}/sap/bc/masraffco/test-connection`;
      await axios.get(url, {
        auth: { username: this.username, password: this.password },
        timeout: 10_000,
      });
      return { connected: true, systemInfo: `SAP HCM @ ${this.baseUrl}` };
    } catch (err: any) {
      return { connected: false, error: err.message };
    }
  }
}

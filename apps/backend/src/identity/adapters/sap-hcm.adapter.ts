import { Logger } from '@nestjs/common';
import axios from 'axios';
import { IIdentityAdapter, IIdentityEmployee } from './identity-adapter.interface';

/**
 * SAP HCM Adapter — ZCL_MASRAFF üzerinden MYDMG_GET_USER_LIST metodunu çağırır.
 *
 * SAP tarafında expose edilmesi gereken endpoint:
 *   POST {SAP_URL}/sap/bc/masraffco/user_list  (veya org config'teki userListPath)
 *
 * Beklenen JSON response (zmasraff_s_persons array):
 * [
 *   {
 *     "PERNR": "00012345",          // Personel numarası → externalId + sapEmployeeId
 *     "NAME":  "Ali",
 *     "SURNAME": "Veli",
 *     "EMAIL": "ali.veli@firma.com",
 *     "ORGEH": "IT",               // Departman
 *     "PLANS": "Yazılım Geliştirici", // Pozisyon
 *     "VORGE": "00012300",         // Yönetici PERNR
 *     "STAT2": "3"                 // Aktiflik: "3" = aktif çalışan
 *   },
 *   ...
 * ]
 *
 * NOT: Alan adları zmasraff_s_persons yapısına göre değişebilir.
 * idpConfig'teki fieldMap ile özelleştirilebilir.
 */
export class SapHcmAdapter implements IIdentityAdapter {
  private readonly logger = new Logger(SapHcmAdapter.name);

  private readonly baseUrl: string;
  private readonly username: string;
  private readonly password: string;
  private readonly userListPath: string;
  private readonly fieldMap: Record<string, string>;

  constructor(config: {
    url: string;
    username: string;
    password: string;
    userListPath?: string;
    fieldMap?: Record<string, string>;
  }) {
    this.baseUrl = config.url.replace(/\/$/, '');
    this.username = config.username;
    this.password = config.password;
    this.userListPath = config.userListPath || '/sap/bc/masraffco/user_list';
    // Varsayılan alan eşleştirme — zmasraff_s_persons yapısına göre değiştirin
    this.fieldMap = config.fieldMap || {
      externalId:        'PERNR',
      firstName:         'NAME',
      lastName:          'SURNAME',
      email:             'EMAIL',
      department:        'ORGEH',
      jobTitle:          'PLANS',
      managerExternalId: 'VORGE',
      statusField:       'STAT2',
      activeValue:       '3',
    };
  }

  async syncUsers(): Promise<IIdentityEmployee[]> {
    const url = `${this.baseUrl}${this.userListPath}`;
    this.logger.log(`SAP HCM user sync: POST ${url}`);

    const response = await axios.post(url, null, {
      auth: { username: this.username, password: this.password },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      timeout: 30000,
    });

    const raw: any[] = Array.isArray(response.data) ? response.data : response.data?.results ?? [];
    const fm = this.fieldMap;

    return raw.map((r): IIdentityEmployee => {
      const firstName = String(r[fm.firstName] || '').trim();
      const lastName  = String(r[fm.lastName]  || '').trim();
      const pernr     = String(r[fm.externalId] || '').trim();
      const statusVal = String(r[fm.statusField] || '').trim();

      return {
        externalId:        pernr,
        sapEmployeeId:     pernr,
        name:              [firstName, lastName].filter(Boolean).join(' ') || pernr,
        email:             String(r[fm.email] || '').trim().toLowerCase(),
        department:        r[fm.department] ? String(r[fm.department]).trim() : undefined,
        jobTitle:          r[fm.jobTitle]   ? String(r[fm.jobTitle]).trim()   : undefined,
        managerExternalId: r[fm.managerExternalId]
                             ? String(r[fm.managerExternalId]).trim()
                             : undefined,
        isActive: fm.activeValue ? statusVal === fm.activeValue : true,
      };
    }).filter(e => e.externalId && e.email); // email ve ID olmayan kayıtları atla
  }

  async testConnection() {
    try {
      const url = `${this.baseUrl}/sap/bc/masraffco/test-connection`;
      await axios.get(url, {
        auth: { username: this.username, password: this.password },
        timeout: 10000,
      });
      return { connected: true, systemInfo: `SAP HCM @ ${this.baseUrl}` };
    } catch (err: any) {
      return { connected: false, error: err.message };
    }
  }
}

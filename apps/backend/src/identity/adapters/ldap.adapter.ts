import { Logger } from '@nestjs/common';
import {
  IIdentityAdapter,
  IIdentityEmployee,
  IOrgUnit,
} from './identity-adapter.interface';

/**
 * LDAP / Active Directory Adapter
 *
 * On-premise Active Directory veya OpenLDAP sunucusundan
 * kullanıcı ve organizasyon birimi (OU) bilgilerini çeker.
 *
 * Bağımlılık: `ldapjs` paketi gereklidir.
 *   npm install ldapjs @types/ldapjs
 *
 * Konfigürasyon:
 * - url:         ldap://dc.company.com:389  veya ldaps://dc.company.com:636
 * - bindDn:      cn=serviceaccount,ou=ServiceAccounts,dc=company,dc=com
 * - bindPassword: ***
 * - searchBase:  dc=company,dc=com
 * - userFilter:  (objectClass=user)    (veya objectClass=person)
 * - ouFilter:    (objectClass=organizationalUnit)
 * - attributes:  sAMAccountName, mail, displayName, department, title, manager, memberOf
 */
export class LdapAdapter implements IIdentityAdapter {
  private readonly logger = new Logger(LdapAdapter.name);

  private readonly url: string;
  private readonly bindDn: string;
  private readonly bindPassword: string;
  private readonly searchBase: string;
  private readonly userFilter: string;
  private readonly ouFilter: string;
  private readonly groupFilter: string;
  private readonly attributes: string[];

  constructor(config: {
    url: string;
    bindDn: string;
    bindPassword: string;
    searchBase: string;
    userFilter?: string;
    ouFilter?: string;
    groupFilter?: string;
    attributes?: string[];
  }) {
    this.url = config.url;
    this.bindDn = config.bindDn;
    this.bindPassword = config.bindPassword;
    this.searchBase = config.searchBase;
    this.userFilter = config.userFilter || '(&(objectClass=user)(objectCategory=person)(mail=*))';
    this.ouFilter = config.ouFilter || '(objectClass=organizationalUnit)';
    this.groupFilter = config.groupFilter || '(objectClass=group)';
    this.attributes = config.attributes || [
      'sAMAccountName', 'mail', 'displayName', 'givenName', 'sn',
      'department', 'title', 'manager', 'memberOf',
      'userAccountControl', 'distinguishedName', 'objectGUID',
      'employeeID', 'employeeNumber',
    ];
  }

  // ─── LDAP Client Oluşturma ─────────────────────────────────────────────
  private async createClient(): Promise<any> {
    // Dinamik import — ldapjs opsiyonel bağımlılık
    let ldap: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      ldap = require('ldapjs');
    } catch {
      throw new Error(
        'ldapjs paketi kurulu değil. Kurmak için: npm install ldapjs @types/ldapjs',
      );
    }

    return new Promise((resolve, reject) => {
      const client = ldap.createClient({
        url: this.url,
        timeout: 30_000,
        connectTimeout: 10_000,
        tlsOptions: { rejectUnauthorized: false }, // Self-signed cert desteği
      });

      client.on('error', (err: Error) => reject(err));

      client.bind(this.bindDn, this.bindPassword, (err: Error | null) => {
        if (err) return reject(new Error(`LDAP bind hatası: ${err.message}`));
        resolve(client);
      });
    });
  }

  /** LDAP search helper */
  private async search(client: any, base: string, filter: string, attrs: string[]): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      client.search(base, {
        filter,
        scope: 'sub',
        attributes: attrs,
        paged: true,
        sizeLimit: 0,
      }, (err: Error | null, res: any) => {
        if (err) return reject(err);
        res.on('searchEntry', (entry: any) => {
          const obj: Record<string, any> = {};
          if (entry.pojo?.attributes) {
            for (const attr of entry.pojo.attributes) {
              obj[attr.type] = attr.values?.length === 1 ? attr.values[0] : attr.values;
            }
          } else if (entry.attributes) {
            for (const attr of entry.attributes) {
              obj[attr.type || attr._name] = attr._vals?.length === 1
                ? attr._vals[0]?.toString()
                : attr._vals?.map((v: Buffer) => v.toString());
            }
          }
          results.push(obj);
        });
        res.on('error', (e: Error) => reject(e));
        res.on('end', () => resolve(results));
      });
    });
  }

  // ─── Çalışan Listesi ───────────────────────────────────────────────────
  async syncUsers(): Promise<IIdentityEmployee[]> {
    this.logger.log(`LDAP user sync: ${this.url} base=${this.searchBase}`);

    const client = await this.createClient();
    try {
      const entries = await this.search(client, this.searchBase, this.userFilter, this.attributes);
      this.logger.log(`LDAP returned ${entries.length} user entries`);

      return entries
        .map((entry): IIdentityEmployee | null => {
          const email = String(entry.mail || '').trim().toLowerCase();
          if (!email) return null;

          const externalId = entry.objectGUID || entry.sAMAccountName || entry.distinguishedName || '';
          const displayName = entry.displayName || '';
          const firstName = entry.givenName || '';
          const lastName = entry.sn || '';
          const name = displayName || [firstName, lastName].filter(Boolean).join(' ') || email;

          // Manager: "CN=Manager Name,OU=Users,DC=company,DC=com" → DN'den parse
          const managerDn = entry.manager || '';

          // userAccountControl bit 2 = ACCOUNTDISABLE
          const uac = parseInt(entry.userAccountControl || '0', 10);
          const isDisabled = (uac & 0x0002) !== 0;

          return {
            externalId: String(externalId),
            name: String(name),
            email,
            department: entry.department ? String(entry.department) : undefined,
            jobTitle: entry.title ? String(entry.title) : undefined,
            managerExternalId: managerDn || undefined, // DN olarak saklanır, Pass 2'de resolve edilir
            sapEmployeeId: entry.employeeID || entry.employeeNumber || undefined,
            isActive: !isDisabled,
          };
        })
        .filter((e): e is IIdentityEmployee => e !== null && !!e.externalId);
    } finally {
      try { client.unbind(); } catch {}
    }
  }

  // ─── Organizasyon Birimleri (OU) ────────────────────────────────────────
  async syncOrgUnits(): Promise<IOrgUnit[]> {
    this.logger.log(`LDAP OU sync: ${this.url}`);

    const client = await this.createClient();
    try {
      const entries = await this.search(
        client,
        this.searchBase,
        this.ouFilter,
        ['ou', 'distinguishedName', 'description', 'managedBy'],
      );

      this.logger.log(`LDAP returned ${entries.length} OU entries`);

      return entries.map((entry): IOrgUnit => {
        const dn = String(entry.distinguishedName || '');
        const ou = String(entry.ou || '');
        // Üst OU: DN'den parent parse — "OU=IT,OU=Departments,DC=..." → parent = "OU=Departments,DC=..."
        const parentDn = this.getParentDn(dn);

        return {
          externalId: dn,
          name: ou || dn,
          code: ou,
          parentExternalId: parentDn || undefined,
          managerExternalId: entry.managedBy || undefined,
        };
      });
    } finally {
      try { client.unbind(); } catch {}
    }
  }

  // ─── Bağlantı Testi ────────────────────────────────────────────────────
  async testConnection() {
    try {
      const client = await this.createClient();
      // Basit bir arama yaparak doğrula
      const entries = await this.search(client, this.searchBase, this.userFilter, ['mail']);
      try { client.unbind(); } catch {}
      return {
        connected: true,
        systemInfo: `LDAP @ ${this.url} — ${entries.length} kullanıcı bulundu`,
      };
    } catch (err: any) {
      return { connected: false, error: err.message };
    }
  }

  // ─── Yardımcı ──────────────────────────────────────────────────────────

  /** DN'den parent DN'i çıkarır: "OU=IT,OU=Deps,DC=co,DC=com" → "OU=Deps,DC=co,DC=com" */
  private getParentDn(dn: string): string | null {
    const parts = dn.split(',');
    if (parts.length <= 1) return null;
    const parent = parts.slice(1).join(',');
    // Eğer parent sadece DC= ise (root), null döndür
    if (!parent.toUpperCase().includes('OU=')) return null;
    return parent;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { IIdentityAdapter } from './identity-adapter.interface';
import { NullAdapter } from './null.adapter';
import { SapHcmAdapter } from './sap-hcm.adapter';
import { SapS4OnPremAdapter } from './sap-s4-onprem.adapter';
import { SapS4CloudAdapter } from './sap-s4-cloud.adapter';
import { AzureAdAdapter } from './azure-ad.adapter';
import { LdapAdapter } from './ldap.adapter';
import { ExternalDbAdapter } from './external-db.adapter';
import { CryptoService } from '../../common/crypto.service';

export type IdpType = 'NONE' | 'SAP_HCM' | 'SAP_S4_ONPREM' | 'SAP_S4_CLOUD' | 'AZURE_AD' | 'LDAP' | 'EXTERNAL_DB';

@Injectable()
export class IdentityAdapterFactory {
  private readonly logger = new Logger(IdentityAdapterFactory.name);

  constructor(private crypto: CryptoService) {}

  /** Env var tabanlı (single-tenant / standalone kurulum) */
  createFromEnv(): IIdentityAdapter {
    const idpType = (process.env.IDENTITY_PROVIDER || 'NONE').toUpperCase() as IdpType;
    return this.createForType(idpType, null);
  }

  /** Organization config tabanlı (multi-tenant SaaS) */
  createForOrg(org: { idpType: string; idpConfig?: string | null }): IIdentityAdapter {
    const idpType = (org.idpType || 'NONE').toUpperCase() as IdpType;
    let config: Record<string, any> | null = null;
    if (org.idpConfig) {
      try {
        config = this.crypto.decryptJson(org.idpConfig);
      } catch (e) {
        this.logger.error(`Failed to decrypt idpConfig: ${e}`);
      }
    }
    return this.createForType(idpType, config);
  }

  private createForType(idpType: IdpType, config: Record<string, any> | null): IIdentityAdapter {
    switch (idpType) {
      case 'SAP_HCM':
        return new SapHcmAdapter({
          url:          config?.url          || process.env.SAP_BASE_URL  || process.env.SAP_URL || '',
          username:     config?.username     || process.env.SAP_USERNAME  || '',
          password:     config?.password     || process.env.SAP_PASSWORD  || '',
          userListPath: config?.userListPath || process.env.SAP_USER_LIST_PATH,
          fieldMap:     config?.fieldMap,
        });

      case 'SAP_S4_ONPREM':
        return new SapS4OnPremAdapter({
          url:              config?.url              || process.env.SAP_BASE_URL  || '',
          username:         config?.username         || process.env.SAP_USERNAME  || '',
          password:         config?.password         || process.env.SAP_PASSWORD  || '',
          oauth2Token:      config?.oauth2Token,
          userListPath:     config?.userListPath,
          orgStructurePath: config?.orgStructurePath,
          positionPath:     config?.positionPath,
        });

      case 'SAP_S4_CLOUD':
        return new SapS4CloudAdapter({
          url:          config?.url          || process.env.SF_BASE_URL   || '',
          companyId:    config?.companyId    || process.env.SF_COMPANY_ID || '',
          tokenUrl:     config?.tokenUrl,
          clientId:     config?.clientId     || process.env.SF_CLIENT_ID  || '',
          clientSecret: config?.clientSecret || process.env.SF_CLIENT_SECRET || '',
          apiKey:       config?.apiKey       || process.env.SF_API_KEY,
          username:     config?.username,
          password:     config?.password,
        });

      case 'AZURE_AD':
        return new AzureAdAdapter({
          tenantId:     config?.tenantId     || process.env.AZURE_TENANT_ID || '',
          clientId:     config?.clientId     || process.env.AZURE_CLIENT_ID || '',
          clientSecret: config?.clientSecret || process.env.AZURE_CLIENT_SECRET || '',
        });

      case 'LDAP':
        return new LdapAdapter({
          url:          config?.url          || process.env.LDAP_URL        || '',
          bindDn:       config?.bindDn       || process.env.LDAP_BIND_DN    || '',
          bindPassword: config?.bindPassword || process.env.LDAP_BIND_PASSWORD || '',
          searchBase:   config?.searchBase   || process.env.LDAP_SEARCH_BASE || '',
          userFilter:   config?.userFilter   || process.env.LDAP_USER_FILTER,
          ouFilter:     config?.ouFilter,
          groupFilter:  config?.groupFilter,
          attributes:   config?.attributes,
        });

      case 'EXTERNAL_DB':
        return new ExternalDbAdapter({
          mode:                 config?.mode || 'REST',
          url:                  config?.url                  || process.env.EXT_API_URL || '',
          apiKey:               config?.apiKey               || process.env.EXT_API_KEY,
          bearerToken:          config?.bearerToken          || process.env.EXT_API_TOKEN,
          username:             config?.username,
          password:             config?.password,
          usersEndpoint:        config?.usersEndpoint,
          departmentsEndpoint:  config?.departmentsEndpoint,
          fieldMap:             config?.fieldMap,
          dbConnectionString:   config?.dbConnectionString   || process.env.EXT_DB_URL,
          dbUserQuery:          config?.dbUserQuery,
          dbDeptQuery:          config?.dbDeptQuery,
        });

      case 'NONE':
      default:
        return new NullAdapter();
    }
  }
}

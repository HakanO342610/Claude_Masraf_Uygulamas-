import { Injectable, Logger } from '@nestjs/common';
import { IIdentityAdapter } from './identity-adapter.interface';
import { NullAdapter } from './null.adapter';
import { SapHcmAdapter } from './sap-hcm.adapter';
import { AzureAdAdapter } from './azure-ad.adapter';
import { CryptoService } from '../../common/crypto.service';

export type IdpType = 'NONE' | 'SAP_HCM' | 'AZURE_AD' | 'LDAP';

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
          url:          config?.url      || process.env.SAP_URL || '',
          username:     config?.username || process.env.SAP_USERNAME || '',
          password:     config?.password || process.env.SAP_PASSWORD || '',
          userListPath: config?.userListPath,
          fieldMap:     config?.fieldMap,
        });

      case 'AZURE_AD':
        return new AzureAdAdapter({
          tenantId:     config?.tenantId     || process.env.AZURE_TENANT_ID || '',
          clientId:     config?.clientId     || process.env.AZURE_CLIENT_ID || '',
          clientSecret: config?.clientSecret || process.env.AZURE_CLIENT_SECRET || '',
        });

      case 'NONE':
      default:
        return new NullAdapter();
    }
  }
}

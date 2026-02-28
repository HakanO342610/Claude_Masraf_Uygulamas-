import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ISapAdapter } from './sap-adapter.interface';
import { SapEccAdapter } from './sap-ecc.adapter';
import { SapS4OnPremAdapter } from './sap-s4-onprem.adapter';
import { SapS4CloudAdapter } from './sap-s4-cloud.adapter';

export type SapType = 'ECC' | 'S4_ONPREM' | 'S4_CLOUD';

@Injectable()
export class SapAdapterFactory {
  private readonly logger = new Logger(SapAdapterFactory.name);

  constructor(private config: ConfigService) {}

  create(): ISapAdapter {
    const sapType = (this.config.get<string>('SAP_TYPE') || 'ECC').toUpperCase() as SapType;

    this.logger.log(`SAP adapter initialized: ${sapType}`);

    switch (sapType) {
      case 'S4_ONPREM':
        return new SapS4OnPremAdapter(this.config);
      case 'S4_CLOUD':
        return new SapS4CloudAdapter(this.config);
      case 'ECC':
      default:
        return new SapEccAdapter(this.config);
    }
  }

  getSapType(): SapType {
    return (this.config.get<string>('SAP_TYPE') || 'ECC').toUpperCase() as SapType;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class SapMasterDataService {
  private readonly logger = new Logger(SapMasterDataService.name);
  private sapClient: AxiosInstance;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.sapClient = axios.create({
      baseURL: this.config.get('SAP_BASE_URL'),
      auth: {
        username: this.config.get('SAP_USERNAME') || '',
        password: this.config.get('SAP_PASSWORD') || '',
      },
      headers: { Accept: 'application/json' },
      timeout: 30000,
    });
  }

  @Cron('0 2 * * *') // Every day at 02:00
  async syncAll() {
    this.logger.log('Starting SAP master data synchronization...');
    await Promise.allSettled([
      this.syncByType('COST_CENTER', '/sap/opu/odata/sap/API_COSTCENTER_SRV/A_CostCenter'),
      this.syncByType('GL_ACCOUNT', '/sap/opu/odata/sap/API_GLACCOUNT_SRV/A_GLAccountInChartOfAccounts'),
      this.syncByType('TAX_CODE', '/sap/opu/odata/sap/API_TAXCODE_SRV/A_TaxCode'),
    ]);
    this.logger.log('SAP master data synchronization completed');
  }

  private async syncByType(type: string, endpoint: string) {
    try {
      const response = await this.sapClient.get(endpoint, {
        params: { $format: 'json' },
      });

      const results = response.data?.d?.results || response.data?.value || [];

      for (const item of results) {
        const code = item.CostCenter || item.GLAccount || item.TaxCode || item.code || '';
        const name = item.CostCenterName || item.GLAccountName || item.TaxCodeName || item.name || code;

        if (!code) continue;

        await this.prisma.sapMasterData.upsert({
          where: { type_code: { type, code } },
          update: { name, isActive: true, syncedAt: new Date() },
          create: { type, code, name },
        });
      }

      this.logger.log(`Synced ${results.length} ${type} records from SAP`);
    } catch (error) {
      this.logger.warn(
        `Failed to sync ${type} from SAP: ${(error as Error).message}. Using local cache.`,
      );
    }
  }

  async getByType(type: string) {
    return this.prisma.sapMasterData.findMany({
      where: { type, isActive: true },
      orderBy: { code: 'asc' },
    });
  }

  async getCostCenters() {
    return this.getByType('COST_CENTER');
  }

  async getGLAccounts() {
    return this.getByType('GL_ACCOUNT');
  }

  async getTaxCodes() {
    return this.getByType('TAX_CODE');
  }
}

/**
 * SAP S/4HANA Cloud (RISE with SAP) Adapter
 * Standard OData APIs via OAuth 2.0 Client Credentials
 */
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import {
  ISapAdapter,
  SapExpensePayload,
  SapPostResult,
  SapConnectionResult,
} from './sap-adapter.interface';

const GL_ACCOUNT_MAP: Record<string, string> = {
  Travel: '770001',
  Accommodation: '770002',
  Meals: '770003',
  Transportation: '770004',
  Office: '770005',
  Other: '770099',
};

export class SapS4CloudAdapter implements ISapAdapter {
  private readonly logger = new Logger(SapS4CloudAdapter.name);
  private readonly companyCode: string;
  private readonly tokenUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl: string;
  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(private config: ConfigService) {
    this.companyCode = config.get('SAP_COMPANY_CODE') || '1000';
    this.baseUrl = config.get('SAP_BASE_URL') || '';
    this.tokenUrl = config.get('SAP_OAUTH_TOKEN_URL') || '';
    this.clientId = config.get('SAP_OAUTH_CLIENT_ID') || '';
    this.clientSecret = config.get('SAP_OAUTH_CLIENT_SECRET') || '';
  }

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.cachedToken;
    }

    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const response = await axios.post(this.tokenUrl, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    });

    this.cachedToken = response.data.access_token;
    this.tokenExpiresAt = Date.now() + (response.data.expires_in || 3600) * 1000;
    return this.cachedToken!;
  }

  private async buildClient(): Promise<AxiosInstance> {
    const token = await this.getAccessToken();
    return axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 30000,
    });
  }

  async postExpense(payload: SapExpensePayload): Promise<SapPostResult> {
    const client = await this.buildClient();

    const idempotencyKey = crypto
      .createHash('sha256')
      .update(payload.id + payload.expenseDate.toISOString())
      .digest('hex');

    const body = {
      header: {
        companyCode: this.companyCode,
        documentDate: payload.expenseDate.toISOString().split('T')[0],
        postingDate: new Date().toISOString().split('T')[0],
        documentType: 'KR',
        reference: payload.reference,
        headerText: `Employee ${payload.category} Expense`,
        currency: payload.currency,
        idempotencyKey,
      },
      items: [
        {
          type: 'GL',
          glAccount: GL_ACCOUNT_MAP[payload.category] || '770099',
          amount: payload.amount - payload.taxAmount,
          debitCredit: 'D',
          costCenter: payload.costCenter || '',
          taxCode: 'V1',
        },
        {
          type: 'TAX',
          glAccount: '191000',
          amount: payload.taxAmount,
          debitCredit: 'D',
          taxCode: 'V1',
        },
        {
          type: 'VENDOR',
          vendor: payload.user.sapEmployeeId || '',
          amount: payload.amount,
          debitCredit: 'C',
        },
      ],
    };

    this.logger.log('[S4_CLOUD] Posting via API_JOURNALENTRY_POST with OAuth');
    const response = await client.post(
      '/API_JOURNALENTRY_POST/JournalEntryPost',
      body,
    );

    const docNumber =
      response.data?.sapDocumentNumber ||
      response.data?.d?.DocumentNumber ||
      `S4CL-${Date.now()}`;

    return { sapDocumentNumber: String(docNumber), status: 'Posted', rawResponse: response.data };
  }

  async testConnection(): Promise<SapConnectionResult> {
    try {
      const client = await this.buildClient();
      await client.get('/API_JOURNALENTRY_POST/$metadata', { timeout: 10000 });
      return { connected: true, systemType: 'SAP S/4HANA Cloud (RISE)' };
    } catch (err: any) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        return {
          connected: true,
          systemType: 'SAP S/4HANA Cloud (RISE)',
          error: 'OAuth authentication failed — check SAP_OAUTH_* variables',
        };
      }
      return {
        connected: false,
        systemType: 'SAP S/4HANA Cloud (RISE)',
        error: err?.message || 'Connection failed',
      };
    }
  }
}

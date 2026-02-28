/**
 * SAP S/4HANA On-Premise Adapter
 * Standard API_JOURNALENTRY_POST OData service via Basic Auth
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

export class SapS4OnPremAdapter implements ISapAdapter {
  private readonly logger = new Logger(SapS4OnPremAdapter.name);
  private readonly client: AxiosInstance;
  private readonly companyCode: string;

  constructor(private config: ConfigService) {
    this.companyCode = config.get('SAP_COMPANY_CODE') || '1000';

    this.client = axios.create({
      baseURL: config.get('SAP_BASE_URL'),
      auth: {
        username: config.get('SAP_USERNAME') || '',
        password: config.get('SAP_PASSWORD') || '',
      },
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 30000,
    });
  }

  async postExpense(payload: SapExpensePayload): Promise<SapPostResult> {
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

    this.logger.log('[S4_ONPREM] Posting via API_JOURNALENTRY_POST');
    const response = await this.client.post(
      '/API_JOURNALENTRY_POST/JournalEntryPost',
      body,
    );

    const docNumber =
      response.data?.sapDocumentNumber ||
      response.data?.d?.DocumentNumber ||
      `S4OP-${Date.now()}`;

    return { sapDocumentNumber: String(docNumber), status: 'Posted', rawResponse: response.data };
  }

  async testConnection(): Promise<SapConnectionResult> {
    try {
      await this.client.get(
        '/API_JOURNALENTRY_POST/$metadata',
        { timeout: 10000 },
      );
      return { connected: true, systemType: 'SAP S/4HANA On-Premise' };
    } catch (err: any) {
      if (err?.response?.status === 401) {
        return {
          connected: true,
          systemType: 'SAP S/4HANA On-Premise',
          error: 'Authentication failed — check SAP_USERNAME / SAP_PASSWORD',
        };
      }
      return {
        connected: false,
        systemType: 'SAP S/4HANA On-Premise',
        error: err?.message || 'Connection failed',
      };
    }
  }
}

/**
 * SAP ECC On-Premise Adapter
 * Custom Z-service (Z_EXP_POST_SRV) via Basic Auth
 * Company code, expense path ve GL mapping env-driven
 */
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
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

export class SapEccAdapter implements ISapAdapter {
  private readonly logger = new Logger(SapEccAdapter.name);
  private readonly client: AxiosInstance;
  private readonly companyCode: string;
  private readonly expensePath: string;

  constructor(private config: ConfigService) {
    this.companyCode = config.get('SAP_COMPANY_CODE') || '1000';
    this.expensePath = config.get('SAP_EXPENSE_PATH') || '/Z_EXP_POST_SRV/ExpenseSet';

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
    // Flat structure expected by typical ECC Z-service
    const body = {
      CompanyCode: this.companyCode,
      EmployeeId: payload.user.sapEmployeeId || '',
      EmployeeName: payload.user.name,
      ExpenseDate: payload.expenseDate.toISOString().split('T')[0],
      PostingDate: new Date().toISOString().split('T')[0],
      DocumentType: 'KR',
      Amount: payload.amount,
      TaxAmount: payload.taxAmount,
      Currency: payload.currency,
      GlAccount: GL_ACCOUNT_MAP[payload.category] || '770099',
      CostCenter: payload.costCenter || '',
      ProjectCode: payload.projectCode || '',
      Description: payload.description || '',
      Reference: payload.reference,
    };

    this.logger.log(`[ECC] Posting to ${this.expensePath}`);
    const response = await this.client.post(this.expensePath, body);

    const docNumber =
      response.data?.DocumentNumber ||
      response.data?.d?.DocumentNumber ||
      response.data?.sapDocumentNumber ||
      `ECC-${Date.now()}`;

    return { sapDocumentNumber: String(docNumber), status: 'Posted', rawResponse: response.data };
  }

  async testConnection(): Promise<SapConnectionResult> {
    try {
      // Try fetching $metadata to verify connectivity and service existence
      const metaPath = this.expensePath.replace(/\/[^/]+$/, '/$metadata');
      await this.client.get(metaPath, { timeout: 10000 });
      return { connected: true, systemType: 'SAP ECC On-Premise' };
    } catch (err: any) {
      // 401 Unauthorized means we reached SAP but credentials are wrong
      if (err?.response?.status === 401) {
        return {
          connected: true,
          systemType: 'SAP ECC On-Premise',
          error: 'Authentication failed — check SAP_USERNAME / SAP_PASSWORD',
        };
      }
      return {
        connected: false,
        systemType: 'SAP ECC On-Premise',
        error: err?.message || 'Connection failed',
      };
    }
  }
}

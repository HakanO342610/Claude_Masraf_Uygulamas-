/**
 * SAP ECC 6.0 On-Premise Adapter
 *
 * Bağlantı: ZCL_MASRAFF (IF_HTTP_EXTENSION) → SICF /sap/bc/masraffco
 *
 * Routing mantığı (ZCL_MASRAFF):
 *   POST /sap/bc/masraffco/{method} → ABAP'ta me->(METHOD) dinamik çağrısı
 *   → /post_expense  : Masraf muhasebeleştirme (POST_EXPENSE method — eklenecek)
 *   → /userlist      : Kullanıcı listesi (mevcut)
 *   → /create_user   : Kullanıcı oluşturma (mevcut)
 *
 * Response format (ZCL_MASRAFF):
 *   { "TYPE": "S"|"E", "MSG_CODE": "<BelgeNo>", "MESSAGE": "..." }
 *   HTTP 200 → başarı veya TYPE=E + MSG_CODE=1
 *   HTTP 400 → TYPE=E hata
 *   HTTP 201/202 → body temizleniyor (TYPE C/A kullanmıyoruz)
 *
 * Test bağlantısı: /sap/bc/ping (SAP ICM standart, her ECC'de aktif)
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

// GL hesap eşleştirmesi — DOHP hesap planı (Şirket 1481)
// Tüm masraf türleri şimdilik tek hesaba → SAP'ta FSS0/FS00'dan alt hesaplar eklenince güncelle
const GL_ACCOUNT_MAP: Record<string, string> = {
  Travel: '7604001001',
  Accommodation: '7604001001',
  Meals: '7604001001',
  Transportation: '7604001001',
  Office: '7604001001',
  'Food & Beverage': '7604001001',
  Other: '7604001001',
};

export class SapEccAdapter implements ISapAdapter {
  private readonly logger = new Logger(SapEccAdapter.name);
  private readonly client: AxiosInstance;
  private readonly companyCode: string;
  private readonly expensePath: string;  // /sap/bc/masraffco/post_expense
  private readonly basePath: string;     // /sap/bc/masraffco
  private readonly sapClient: string;

  constructor(private config: ConfigService) {
    this.companyCode = config.get('SAP_COMPANY_CODE') || '1481';
    this.expensePath = config.get('SAP_EXPENSE_PATH') || '/sap/bc/masraffco/post_expense';
    this.sapClient   = config.get('SAP_CLIENT')       || '200';

    // Base path: /sap/bc/masraffco/post_expense → /sap/bc/masraffco
    this.basePath = this.expensePath.replace(/\/[^/]+$/, '');

    this.client = axios.create({
      baseURL: config.get('SAP_BASE_URL'),  // http://SAPR3-TEST.hepsiburada.dmz:8000
      auth: {
        username: config.get('SAP_USERNAME') || '',
        password: config.get('SAP_PASSWORD') || '',
      },
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'sap-client': this.sapClient,
      },
      timeout: 30000,
    });
  }

  // ─── Masraf Posting ────────────────────────────────────────────────────────
  // ZCL_MASRAFF → POST_EXPENSE method
  // Response: { TYPE, MSG_CODE (belge no), MESSAGE, DOCUMENT_NUMBER, FISCAL_YEAR }

  async postExpense(payload: SapExpensePayload): Promise<SapPostResult> {
    // ZCL_MASRAFF → POST_EXPENSE methodunun beklediği JSON
    const body = {
      CompanyCode:  this.companyCode,
      EmployeeId:   payload.user.sapEmployeeId || '',
      EmployeeName: payload.user.name,
      ExpenseDate:  payload.expenseDate.toISOString().split('T')[0].replace(/-/g, ''),  // YYYYMMDD
      PostingDate:  new Date().toISOString().split('T')[0].replace(/-/g, ''),           // YYYYMMDD
      DocumentType: 'SA',
      Amount:       payload.amount,
      TaxAmount:    payload.taxAmount,
      Currency:     payload.currency,
      GlAccount:    GL_ACCOUNT_MAP[payload.category] || '7604001001',
      CostCenter:   (payload.costCenter || '').replace(/^CC-/i, ''),  // CC-1002 → 1002
      ProjectCode:  payload.projectCode || '',
      Description:  (payload.description || '').substring(0, 50),
      Reference:    payload.reference,  // EXP-XXXXXXXX
    };

    this.logger.log(`[ECC/Masraffco] POST ${this.expensePath} — ref: ${body.Reference}`);
    this.logger.debug(`[ECC/Masraffco] Payload: ${JSON.stringify(body)}`);

    let response: any;
    try {
      response = await this.client.post(this.expensePath, body);
    } catch (err: any) {
      const sapErr = err?.response?.data;
      this.logger.error(`[ECC/Masraffco] HTTP ${err?.response?.status} — ${JSON.stringify(sapErr)}`);
      throw new Error(`SAP Hatası: ${sapErr?.MESSAGE || err?.message}`);
    }
    const data = response.data as Record<string, any>;

    this.logger.debug(`[ECC/Masraffco] Response: ${JSON.stringify(data)}`);

    // ZCL_MASRAFF hata kontrolü: TYPE='E' ve MSG_CODE != '1'
    if (data?.TYPE === 'E' && data?.MSG_CODE !== '1') {
      throw new Error(`SAP FI Hatası: ${data.MESSAGE || 'Bilinmeyen hata'}`);
    }

    // Belge numarası: DOCUMENT_NUMBER veya MSG_CODE alanında döner
    const docNumber =
      data?.DOCUMENT_NUMBER ||
      data?.DocumentNumber  ||
      data?.MSG_CODE        ||
      `ECC-${Date.now()}`;

    return {
      sapDocumentNumber: String(docNumber),
      status: 'Posted',
      rawResponse: data,
    };
  }

  // ─── Bağlantı Testi ───────────────────────────────────────────────────────
  // 1. /sap/bc/ping → ICM erişimi
  // 2. /sap/bc/masraffco/userlist → ZCL_MASRAFF servis testi

  async testConnection(): Promise<SapConnectionResult> {
    // Adım 1: SAP ICM erişim kontrolü
    try {
      await this.client.get('/sap/bc/ping', { timeout: 8000 });
    } catch (err: any) {
      return {
        connected: false,
        systemType: 'SAP ECC 6.0 On-Premise',
        error: `SAP ICM erişilemiyor: ${err?.message}`,
      };
    }

    // Adım 2: ZCL_MASRAFF servis kontrolü (userlist — mevcut endpoint)
    try {
      const res = await this.client.post(
        `${this.basePath}/userlist`,
        '{}',
        { timeout: 8000 },
      );

      // HTTP 200 veya 400 → servis aktif, routing çalışıyor
      const serviceActive = [200, 400].includes(res.status);

      return {
        connected: true,
        systemType: 'SAP ECC 6.0 — ZCL_MASRAFF (/sap/bc/masraffco)',
        sapSystem: `Client ${this.sapClient} | Şirket ${this.companyCode}`,
        ...(serviceActive
          ? {}
          : { error: 'ZCL_MASRAFF servisi beklenmedik yanıt verdi' }),
      };
    } catch (err: any) {
      const status = err?.response?.status;

      // 401/403 → servise ulaşıldı ama yetki sorunu
      if (status === 401 || status === 403) {
        return {
          connected: true,
          systemType: 'SAP ECC 6.0 — ZCL_MASRAFF (/sap/bc/masraffco)',
          error: 'Authentication başarısız — SAP_USERNAME / SAP_PASSWORD kontrol edin',
        };
      }

      return {
        connected: false,
        systemType: 'SAP ECC 6.0 On-Premise',
        error: `ZCL_MASRAFF servis hatası: ${err?.message}`,
      };
    }
  }
}

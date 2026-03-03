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
    // KDV ayrıştırma: Matrah = Brüt - KDV
    const grossAmount  = +payload.amount.toFixed(2);
    const taxAmount    = +payload.taxAmount.toFixed(2);
    const netAmount    = +(grossAmount - taxAmount).toFixed(2);  // Matrah (gider GL)
    // TR KDV: Temmuz 2023'ten itibaren %20. SAP vergi kodu env ile override edilebilir.
    const taxGlAccount = this.config.get('SAP_TAX_GL_ACCOUNT') || '1910001018';
    const taxCode      = this.config.get('SAP_TAX_CODE')        || 'V3';  // V3=%20 olarak SAP'ta güncelleyin

    // ZCL_MASRAFF → POST_EXPENSE — Gerçek SAP belge yapısı (örnek belgeye göre):
    //   Klm 1 (40/Borç):  GlAccount    ← NetAmount  (Matrah — Araç Yakıt Giderleri vb.)
    //   Klm 2 (50/Alacak): 3350001001  ← GrossAmount (Personele Ödenecek — Brüt)
    //   Klm 3 (40/Borç):  TaxGlAccount ← TaxAmount  (%18 İndirilecek KDV, 1910001018)
    const body: Record<string, any> = {
      CompanyCode:  this.companyCode,
      EmployeeId:   payload.user.sapEmployeeId || '',
      EmployeeName: payload.user.name,
      ExpenseDate:  payload.expenseDate.toISOString().split('T')[0].replace(/-/g, ''),
      PostingDate:  new Date().toISOString().split('T')[0].replace(/-/g, ''),
      DocumentType: 'SA',
      NetAmount:    netAmount,      // Matrah → Klm 1 Gider GL (Borç)
      TaxAmount:    taxAmount,      // KDV   → Klm 3 İndirilecek KDV GL (Borç)
      GrossAmount:  grossAmount,    // Brüt  → Klm 2 Personele Ödenecek (Alacak)
      Amount:       grossAmount,    // Geriye dönük uyumluluk
      TaxCode:      taxCode,        // V3 — %18 KDV vergi kodu (env: SAP_TAX_CODE)
      TaxGlAccount: taxGlAccount,   // 1910001018 — İndirilecek KDV (env: SAP_TAX_GL_ACCOUNT)
      Currency:     payload.currency,
      GlAccount:    GL_ACCOUNT_MAP[payload.category] || '7604001001',
      CostCenter:   ((payload.costCenter || '').replace(/^CC-/i, '')).padStart(10, '0'),  // SAP KOSTL CHAR(10) — leading zero pad
      ProjectCode:  payload.projectCode || '',
      Description:  (payload.description || '').substring(0, 50),
      Reference:    payload.receiptNumber || payload.reference,  // Fiş/Fatura no öncelikli
      FisNo:        payload.receiptNumber || '',  // ZCL_MASRAFF POST_EXPENSE — fiş/fatura no alanı
    };

    // Retry/Debug flag'leri — SAP tarafında tekrarlı log'u ve commit'i kontrol etmek için
    // RetryAttempt > 1 ise ABAP log atmasın, DebugMode = 'X' ise BAPI_TRANSACTION_COMMIT çağırmasın
    if ((payload as any).retryAttempt) {
      body.RetryAttempt = (payload as any).retryAttempt;
    }
    if ((payload as any).debugMode) {
      body.DebugMode = 'X';
    }

    this.logger.log(`[ECC/Masraffco] POST ${this.expensePath} — ref: ${body.Reference}`);
    this.logger.log(`[ECC/Masraffco] Payload: ${JSON.stringify(body)}`);

    let response: any;
    try {
      response = await this.client.post(this.expensePath, body);
    } catch (err: any) {
      const sapErr = err?.response?.data;
      this.logger.error(`[ECC/Masraffco] HTTP ${err?.response?.status} — ${JSON.stringify(sapErr)}`);
      throw new Error(`SAP Hatası: ${sapErr?.MESSAGE || err?.message}`);
    }
    const data = response.data as Record<string, any>;

    // LOG seviyesi — terminalde her zaman görünsün
    this.logger.log(`[ECC/Masraffco] RAW RESPONSE: ${JSON.stringify(data)}`);

    // ZCL_MASRAFF hata kontrolü: TYPE='E' ve MSG_CODE != '1'
    if (data?.TYPE === 'E' && data?.MSG_CODE !== '1') {
      throw new Error(
        `SAP FI Hatası — TYPE:${data.TYPE} | MSG_CODE:${data.MSG_CODE} | ${data.MESSAGE || 'Bilinmeyen hata'}`,
      );
    }

    // Belge numarası: DOCUMENT_NUMBER öncelikli, yoksa MSG_CODE
    const rawDocNumber =
      data?.DOCUMENT_NUMBER ||
      data?.DocumentNumber  ||
      data?.MSG_CODE;

    // Geçerli belge no kontrolü: en az 5 karakter, sayısal/alfanümerik, "$" veya boş değil
    const isValidDocNumber =
      rawDocNumber &&
      String(rawDocNumber).trim().length >= 5 &&
      /^[A-Z0-9\-]+$/i.test(String(rawDocNumber).trim());

    // ─── TYPE=S (başarılı) ama belge numarası geçersiz/placeholder ($) ise ───
    // SAP belgeyi oluşturdu ancak ZCL_MASRAFF doc number'ı düzgün dönmüyor.
    // Bu durumda başarılı kabul et — fallback doc number ile kaydet.
    if (!isValidDocNumber) {
      const isSuccessResponse =
        data?.TYPE === 'S' ||
        (data?.MESSAGE && String(data.MESSAGE).toUpperCase().includes('OK'));

      if (isSuccessResponse) {
        const fallbackDocNumber = `SAP-OK-${Date.now()}`;
        this.logger.warn(
          `[ECC/Masraffco] TYPE=S ama belge no geçersiz ("${rawDocNumber}"). Fallback: ${fallbackDocNumber}. Ham yanıt: ${JSON.stringify(data)}`,
        );
        return {
          sapDocumentNumber: fallbackDocNumber,
          fiscalYear: undefined,
          status: 'Posted',
          rawResponse: data,
        };
      }

      // TYPE != S → gerçek hata
      throw new Error(
        `SAP geçersiz belge numarası döndü: "${rawDocNumber}" | TYPE:${data?.TYPE} | MSG:${data?.MESSAGE || '-'} | Ham yanıt: ${JSON.stringify(data)}`,
      );
    }

    const docNumber = String(rawDocNumber).trim();

    // Mali yıl: FISCAL_YEAR alanında döner (opsiyonel)
    const fiscalYear = data?.FISCAL_YEAR
      ? String(data.FISCAL_YEAR).trim()
      : undefined;

    if (fiscalYear === '0000' || fiscalYear === '') {
      this.logger.warn(
        `[ECC/Masraffco] FISCAL_YEAR geçersiz (${fiscalYear}) — belge: ${docNumber}`,
      );
    }

    return {
      sapDocumentNumber: docNumber,
      fiscalYear,
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

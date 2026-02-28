import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as path from 'path';
import * as fs from 'fs';

import * as Tesseract from 'tesseract.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class ReceiptsService {
  private readonly logger = new Logger(ReceiptsService.name);

  constructor(private prisma: PrismaService) {}

  async upload(file: Express.Multer.File, userId: string) {
    if (!file) throw new BadRequestException('No file provided');

    const receipt = await this.prisma.receipt.create({
      data: {
        fileName: file.originalname,
        filePath: file.path,
        mimeType: file.mimetype,
        fileSize: file.size,
        uploadedBy: userId,
      },
    });

    const ocrData = await this.processOcr(receipt.id, file.path, file.mimetype);

    return {
      id: receipt.id,
      fileName: receipt.fileName,
      ocrStatus: ocrData ? 'COMPLETED' : 'FAILED',
      ocrData,
    };
  }

  async attachToExpense(receiptId: string, expenseId: string, userId: string) {
    const receipt = await this.prisma.receipt.findUnique({
      where: { id: receiptId },
    });
    if (!receipt) throw new NotFoundException('Receipt not found');
    if (receipt.uploadedBy !== userId) {
      throw new BadRequestException('You can only attach your own receipts');
    }

    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
    });
    if (!expense) throw new NotFoundException('Expense not found');
    if (expense.userId !== userId) {
      throw new BadRequestException('You can only attach receipts to your own expenses');
    }

    const updated = await this.prisma.receipt.update({
      where: { id: receiptId },
      data: { expenseId },
    });

    await this.prisma.expense.update({
      where: { id: expenseId },
      data: { receiptUrl: receipt.filePath },
    });

    return updated;
  }

  async getByExpense(expenseId: string, userId: string, userRole: string) {
    // Admins, Managers and Finance can view any expense's receipts
    const elevated = ['ADMIN', 'MANAGER', 'FINANCE'].includes(userRole);
    if (!elevated) {
      const expense = await this.prisma.expense.findUnique({
        where: { id: expenseId },
        select: { userId: true },
      });
      if (!expense) throw new NotFoundException('Expense not found');
      if (expense.userId !== userId) {
        throw new ForbiddenException('Access denied');
      }
    }

    return this.prisma.receipt.findMany({
      where: { expenseId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        ocrStatus: true,
        ocrData: true,
        createdAt: true,
        expenseId: true,
      },
    });
  }

  async getMyReceipts(userId: string) {
    return this.prisma.receipt.findMany({
      where: { uploadedBy: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ─── Gemini Vision OCR ─────────────────────────────────────────────────────

  private async processOcrWithGemini(
    filePath: string,
    mimeType: string,
  ): Promise<Record<string, any> | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const absolutePath = path.resolve(filePath);
      const imageBuffer = fs.readFileSync(absolutePath);
      const base64Image = imageBuffer.toString('base64');

      // PDF→jpeg dönüşümü Gemini desteklemediği için PDF'leri atla
      const supportedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      const imageMime = supportedMimes.includes(mimeType) ? mimeType : 'image/jpeg';

      const prompt = `You are a receipt OCR system. Analyze this receipt image carefully.
Return ONLY a valid JSON object — no extra text, no markdown, no code blocks.
JSON fields:
{
  "vendor": "store or company name (e.g. BIM BIRLESIK MAGAZALAR A.S.), or null",
  "date": "date in YYYY-MM-DD format as string, or null",
  "amount": total amount as number (e.g. 549.81) — this MUST be the FINAL total amount at the bottom of the receipt (usually labelled TOPLAM, T.TOPLAM, or GENEL TOPLAM). DO NOT use the price of individual items.,
  "taxAmount": KDV/VAT amount as number (e.g. 32.39) — look for TOPKDV or KDV or TOPLAM KDV line, or null,
  "currency": "3-letter ISO code: TRY, USD, EUR, GBP, CHF — default TRY if not visible",
  "category": "one of exactly: Travel, Accommodation, Meals, Transportation, Office, Other"
}
IMPORTANT: The amount field on Turkish receipts often has a * prefix like *27.50 — ignore the * and extract only the number. Ensure the amount is the HIGHEST total value at the bottom (TOPLAM).
For vendor: use the company/store name at the top of the receipt (e.g. MIGROS TICARET A.S.).`;

      const result = await model.generateContent([
        prompt,
        { inlineData: { data: base64Image, mimeType: imageMime } },
      ]);

      const responseText = result.response.text().trim();
      const jsonText = responseText.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(jsonText);

      const parseAmount = (val: any) => {
        if (val == null) return null;
        if (typeof val === 'number') return val;
        const cleaned = String(val).replace(/[^0-9,.-]/g, '').replace(',', '.');
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
      };

      return {
        extractedVendor: parsed.vendor ?? null,
        extractedDate: parsed.date ?? null,
        extractedAmount: parseAmount(parsed.amount),
        extractedTaxAmount: parseAmount(parsed.taxAmount),
        extractedCategory: parsed.category ?? null,
        currency: parsed.currency ?? 'TRY',
        confidence: 99,
        rawText: responseText,
        ocrEngine: 'gemini-2.0-flash',
      };
    } catch (err) {
      this.logger.warn(`Gemini OCR failed: ${(err as Error).message}`);
      return null;
    }
  }

  // ─── Tesseract Fallback OCR ────────────────────────────────────────────────

  private async processOcrWithTesseract(
    filePath: string,
  ): Promise<Record<string, any> | null> {
    try {
      const absolutePath = path.resolve(filePath);
      const worker = await Tesseract.createWorker('eng+tur');
      const ret = await worker.recognize(absolutePath);
      const text = ret.data.text;
      const confidence = ret.data.confidence;
      await worker.terminate();

      let extractedAmount: number | null = null;
      let extractedTaxAmount: number | null = null;
      let extractedDate: string | null = null;
      let extractedVendor: string | null = null;
      let currency = 'TRY';

      const lines = text
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const fullText = text;
      const fullTextLower = text.toLowerCase();

      // --- Vendor: smart detection using known chain names ---
      const knownVendors: Record<string, RegExp> = {
        'BIM Birleşik Mağazalar': /b[i\u0131]m\s*b[i\u0131]rle[sş][i\u0131]k/i,
        'Migros': /migros/i,
        'A101': /a\s*101/i,
        'ŞOK Marketler': /[sş][oö]k\s*market/i,
        'CarrefourSA': /carrefour/i,
        'Teknosa': /teknosa/i,
        'MediaMarkt': /mediamarkt/i,
        'LC Waikiki': /waikiki/i,
        'Koçtaş': /ko[cç]ta[sş]/i,
        'Burger King': /burger\s*king/i,
        'McDonald\'s': /mcdonald/i,
        'Starbucks': /starbucks/i,
        'Opet': /opet/i,
        'Shell': /shell/i,
        'BP': /\bbp\b/i,
      };

      for (const [name, regex] of Object.entries(knownVendors)) {
        if (regex.test(fullText)) {
          extractedVendor = name;
          break;
        }
      }

      // Fallback: use first non-trivial line if no known vendor found
      if (!extractedVendor) {
        for (const line of lines) {
          if (line.length > 3 && !/^\d+$/.test(line) && !/^[\*\-=]+$/.test(line)) {
            extractedVendor = line;
            break;
          }
        }
      }

      // --- Date: DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY ---
      const dateRegex = /\b(\d{2})[\.\/\-](\d{2})[\.\/\-](\d{4})\b/;
      for (const line of lines) {
        const m = line.match(dateRegex);
        if (m) {
          extractedDate = `${m[3]}-${m[2]}-${m[1]}`;
          break;
        }
      }

      // --- Currency detection ---
      if (fullTextLower.includes('$') || fullTextLower.includes('usd')) {
        currency = 'USD';
      } else if (fullTextLower.includes('€') || fullTextLower.includes('eur')) {
        currency = 'EUR';
      }

      // --- Amount parsing ---
      // Helper: extract numeric amount from text
      // Tesseract misreads the * prefix on BIM receipts as «, x, or merges with digits
      const extractAmountFromSegment = (segment: string): number | null => {
        // Strip common * misreads: «, x, X and actual *
        const cleaned = segment.replace(/^[«x*X\s]+/, '').trim();

        // Turkish format: 1.234,56 (dot=thousands, comma=decimal)
        const turkishMatch = cleaned.match(/(\d{1,3}(?:\.\d{3})+,\d{2})/);
        if (turkishMatch) {
          return parseFloat(turkishMatch[1].replace(/\./g, '').replace(',', '.'));
        }

        // Simple comma-decimal: 27,50
        const commaMatch = cleaned.match(/(\d+),(\d{2})/);
        if (commaMatch) {
          return parseFloat(`${commaMatch[1]}.${commaMatch[2]}`);
        }

        // Dot-decimal: 27.50 (common in BIM receipts)
        const dotMatch = cleaned.match(/(\d+)\.(\d{2})/);
        if (dotMatch) {
          return parseFloat(`${dotMatch[1]}.${dotMatch[2]}`);
        }

        return null;
      };

      // Extract the amount part after a keyword on the same line
      const extractAmountAfterKeyword = (line: string, keyword: RegExp): number | null => {
        const keyMatch = line.match(keyword);
        if (!keyMatch) return null;
        // Get everything after the keyword
        const afterKeyword = line.substring(keyMatch.index! + keyMatch[0].length);
        return extractAmountFromSegment(afterKeyword);
      };

      // --- TOPLAM (total) extraction ---
      const totalKeyword = /(?:GENEL\s*TOPLAM|(?<!TOP\s*K\s*D\s*V.*)TOPLAM|TOTAL|TUTAR)/i;
      const kdvKeyword = /(?:TOP\s*K\s*D\s*V|K\s*D\s*V\s*TOPLAM|KDV)/i;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // --- Extract KDV ---
        if (kdvKeyword.test(line)) {
          extractedTaxAmount = extractAmountAfterKeyword(line, kdvKeyword);
          // If not found on same line, try next line
          if (extractedTaxAmount == null && i + 1 < lines.length) {
            extractedTaxAmount = extractAmountFromSegment(lines[i + 1]);
          }
        }

        // --- Extract TOPLAM (skip TOPKDV lines) ---
        if (totalKeyword.test(line) && !kdvKeyword.test(line)) {
          extractedAmount = extractAmountAfterKeyword(line, totalKeyword);
          // If not found on same line, try next line
          if (extractedAmount == null && i + 1 < lines.length) {
            extractedAmount = extractAmountFromSegment(lines[i + 1]);
          }
          if (extractedAmount != null) break;
        }
      }

      // Fallback: look for amounts with * or «/x prefix patterns
      if (!extractedAmount) {
        let maxAmount = 0;
        for (const line of lines) {
          // Match patterns like *27.50, «0.27, x27,50
          const allPrefixed = [...line.matchAll(/[*«xX]\s*(\d+[.,]\d{2})/g)];
          for (const m of allPrefixed) {
            const val = extractAmountFromSegment(m[1]);
            if (val != null && val > maxAmount) maxAmount = val;
          }
        }
        if (maxAmount > 0) extractedAmount = maxAmount;
      }

      // Fallback: largest amount in the bottom half
      if (!extractedAmount) {
        const searchStart = Math.max(0, Math.floor(lines.length * 0.5));
        let maxAmount = 0;
        for (let i = searchStart; i < lines.length; i++) {
          const val = extractAmountFromSegment(lines[i]);
          if (val != null && val > maxAmount) maxAmount = val;
        }
        if (maxAmount > 0) extractedAmount = maxAmount;
      }

      // --- Category inference ---
      let extractedCategory: string | null = null;
      const categoryKeywords: Record<string, RegExp> = {
        Meals: /(?:restoran|restaurant|cafe|yemek|burger|pizza|kebap|d[öo]ner|food|lokanta|market|migros|bim|a101|[sş]ok|carrefour|gida|g[i\u0131]da)/i,
        Transportation: /(?:taksi|taxi|uber|bolt|otob[üu]s|metro|vapur|benzin|akaryak[ıi]t|opet|bp|shell|petrol|otopark|parking)/i,
        Travel: /(?:otel|hotel|airways|airline|havayolu|thy|pegasus|u[çc]ak|flight|bilet|ticket)/i,
        Accommodation: /(?:otel|hotel|booking|airbnb|konaklama|pansiyon)/i,
        Office: /(?:k[ıi]rtasiye|ofis|office|teknosa|mediamarkt|hepsiburada|amazon|trendyol)/i,
      };

      for (const [category, regex] of Object.entries(categoryKeywords)) {
        if (regex.test(fullTextLower)) {
          extractedCategory = category;
          break;
        }
      }

      return {
        extractedAmount,
        extractedTaxAmount,
        extractedDate,
        extractedVendor,
        extractedCategory,
        currency,
        confidence,
        rawText: text,
        ocrEngine: 'tesseract',
      };
    } catch (err) {
      this.logger.warn(`Tesseract OCR failed: ${(err as Error).message}`);
      return null;
    }
  }

  // ─── Main OCR dispatcher ──────────────────────────────────────────────────

  private async processOcr(
    receiptId: string,
    filePath: string,
    mimeType: string,
  ): Promise<Record<string, any> | null> {
    try {
      await this.prisma.receipt.update({
        where: { id: receiptId },
        data: { ocrStatus: 'PROCESSING' },
      });

      // 1) Gemini Vision (önce dene — daha doğru)
      let ocrData = await this.processOcrWithGemini(filePath, mimeType);

      // 2) Tesseract fallback
      if (!ocrData) {
        this.logger.log(`Gemini unavailable, falling back to Tesseract for receipt ${receiptId}`);
        ocrData = await this.processOcrWithTesseract(filePath);
      }

      if (ocrData) {
        await this.prisma.receipt.update({
          where: { id: receiptId },
          data: { ocrStatus: 'COMPLETED', ocrData: ocrData as any },
        });
        this.logger.log(
          `OCR completed for receipt ${receiptId} via ${ocrData.ocrEngine}`,
        );
      } else {
        await this.prisma.receipt.update({
          where: { id: receiptId },
          data: { ocrStatus: 'FAILED' },
        });
      }

      return ocrData;
    } catch (error) {
      await this.prisma.receipt.update({
        where: { id: receiptId },
        data: { ocrStatus: 'FAILED' },
      });
      this.logger.warn(`OCR failed for receipt ${receiptId}: ${(error as Error).message}`);
      return null;
    }
  }
}

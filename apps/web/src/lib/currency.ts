/** Supported currency codes */
const SUPPORTED_CURRENCIES = ['TRY', 'USD', 'EUR'] as const;
type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

/**
 * Approximate exchange rates to TRY.
 * In production, these should come from a live API or backend config.
 * Last updated: 2026-02-28
 */
const EXCHANGE_RATES_TO_TRY: Record<CurrencyCode, number> = {
  TRY: 1,
  USD: 36.5,
  EUR: 38.2,
};

/** Currency display symbols */
const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  TRY: '₺',
  USD: '$',
  EUR: '€',
};

/** Currency flag emojis for visual identification */
const CURRENCY_FLAGS: Record<CurrencyCode, string> = {
  TRY: '🇹🇷',
  USD: '🇺🇸',
  EUR: '🇪🇺',
};

/**
 * Convert an amount from a given currency to TRY
 */
function convertToTRY(amount: number, fromCurrency: string): number {
  const rate = EXCHANGE_RATES_TO_TRY[fromCurrency as CurrencyCode];
  if (!rate) {
    return amount; // fallback: assume TRY if unknown currency
  }
  return amount * rate;
}

/**
 * Format a number as a currency string using Turkish locale
 */
function formatCurrency(amount: number, currency: string = 'TRY'): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Group amounts by currency and calculate totals
 */
interface CurrencyTotal {
  currency: string;
  total: number;
  totalInTRY: number;
  count: number;
  symbol: string;
  flag: string;
}

function calculateCurrencyTotals(
  items: Array<{ amount: number | string; currency: string }>
): {
  byCurrency: CurrencyTotal[];
  grandTotalInTRY: number;
} {
  const grouped: Record<string, { total: number; count: number }> = {};

  for (const item of items) {
    const currency = item.currency || 'TRY';
    const amount = Number(item.amount || 0);

    if (!grouped[currency]) {
      grouped[currency] = { total: 0, count: 0 };
    }
    grouped[currency].total += amount;
    grouped[currency].count += 1;
  }

  const byCurrency: CurrencyTotal[] = Object.entries(grouped).map(
    ([currency, data]) => ({
      currency,
      total: data.total,
      totalInTRY: convertToTRY(data.total, currency),
      count: data.count,
      symbol: CURRENCY_SYMBOLS[currency as CurrencyCode] || currency,
      flag: CURRENCY_FLAGS[currency as CurrencyCode] || '',
    })
  );

  // Sort: TRY first, then others alphabetically
  byCurrency.sort((a, b) => {
    if (a.currency === 'TRY') return -1;
    if (b.currency === 'TRY') return 1;
    return a.currency.localeCompare(b.currency);
  });

  const grandTotalInTRY = byCurrency.reduce((sum, c) => sum + c.totalInTRY, 0);

  return { byCurrency, grandTotalInTRY };
}

export {
  SUPPORTED_CURRENCIES,
  EXCHANGE_RATES_TO_TRY,
  CURRENCY_SYMBOLS,
  CURRENCY_FLAGS,
  convertToTRY,
  formatCurrency,
  calculateCurrencyTotals,
};
export type { CurrencyCode, CurrencyTotal };

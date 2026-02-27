export const EXPENSE_CATEGORIES = [
  'Travel',
  'Accommodation',
  'Food & Beverage',
  'Transportation',
  'Office Supplies',
  'Communication',
  'Training',
  'Entertainment',
  'Other',
] as const;

export const CURRENCIES = ['TRY', 'USD', 'EUR', 'GBP'] as const;

export const FILE_UPLOAD = {
  MAX_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_MIME_TYPES: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ],
} as const;

export const SAP_MASTER_DATA_TYPES = [
  'COST_CENTER',
  'GL_ACCOUNT',
  'TAX_CODE',
] as const;

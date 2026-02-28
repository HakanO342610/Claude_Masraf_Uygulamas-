'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, Send, ArrowLeft, Loader2, Upload, FileText, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { expenseApi, receiptsApi } from '@/lib/api';
import { useI18nStore } from '@/lib/store';

const CATEGORIES = [
  'Travel',
  'Accommodation',
  'Meals',
  'Transportation',
  'Office',
  'Other',
] as const;

const CURRENCIES = ['TRY', 'USD', 'EUR', 'GBP'] as const;

const getExpenseSchema = (t: any) => z.object({
  expenseDate: z.string().min(1, t.validationDate),
  amount: z.coerce.number().positive(t.validationAmount),
  taxAmount: z.preprocess(
    (val) => (val === '' || val === undefined || val === null ? undefined : Number(val)),
    z.number().min(0).optional(),
  ),
  currency: z.string().min(1, t.validationCurrency),
  category: z.string().min(1, t.validationCategory),
  costCenter: z.string().optional(),
  projectCode: z.string().optional(),
  description: z.string().min(1, t.validationDescRequired).max(500, t.validationDescLong),
});

type ExpenseFormData = {
  expenseDate: string;
  amount: number;
  taxAmount?: number;
  currency: string;
  category: string;
  costCenter?: string;
  projectCode?: string;
  description: string;
};

export default function NewExpensePage() {
  const router = useRouter();
  const { t } = useI18nStore();
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // OCR additions
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedReceiptId, setUploadedReceiptId] = useState<string | null>(null);
  const [ocrMessage, setOcrMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(getExpenseSchema(t)),
    defaultValues: {
      currency: 'TRY',
      expenseDate: new Date().toISOString().split('T')[0],
    },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setOcrMessage(null);

    try {
      const res = await receiptsApi.upload(file);
      const data = res.data;
      setUploadedReceiptId(data.id);
      
      if (data.ocrData) {
        let fieldsUpdated = 0;
        
        if (data.ocrData.extractedAmount != null) {
          setValue('amount', data.ocrData.extractedAmount, { shouldValidate: true });
          fieldsUpdated++;
        }
        if (data.ocrData.extractedDate) {
          setValue('expenseDate', data.ocrData.extractedDate, { shouldValidate: true });
          fieldsUpdated++;
        }
        if (data.ocrData.extractedVendor) {
          setValue('description', `Expense at ${data.ocrData.extractedVendor}`, { shouldValidate: true });
          fieldsUpdated++;
        }
        if (data.ocrData.currency) {
          setValue('currency', data.ocrData.currency, { shouldValidate: true });
          fieldsUpdated++;
        }
        if (data.ocrData.extractedCategory && ['Travel', 'Accommodation', 'Meals', 'Transportation', 'Office', 'Other'].includes(data.ocrData.extractedCategory)) {
          setValue('category', data.ocrData.extractedCategory, { shouldValidate: true });
          fieldsUpdated++;
        }
        if (data.ocrData.extractedTaxAmount != null) {
          setValue('taxAmount', data.ocrData.extractedTaxAmount, { shouldValidate: true });
          fieldsUpdated++;
        }
        
        if (fieldsUpdated > 0) {
          setOcrMessage(`${t.receiptUploadedAutoFilled} ${fieldsUpdated} ${t.fieldsUsingOcr}`);
        } else {
          setOcrMessage(`${t.couldNotExtractData}`);
        }
      } else {
        setOcrMessage(t.receiptUploadedSuccess);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || t.uploadFailed);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const saveAsDraft = async (data: ExpenseFormData) => {
    setError(null);
    setIsSaving(true);
    try {
      const response = await expenseApi.create(data);
      const expenseId = response.data?.id || response.data?.data?.id;
      if (expenseId && uploadedReceiptId) {
        await receiptsApi.attachToExpense(uploadedReceiptId, expenseId);
      }
      router.push('/dashboard/expenses');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save expense');
    } finally {
      setIsSaving(false);
    }
  };

  const submitExpense = async (data: ExpenseFormData) => {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await expenseApi.create(data);
      const expenseId = response.data?.id || response.data?.data?.id;
      if (expenseId) {
        if (uploadedReceiptId) {
          await receiptsApi.attachToExpense(uploadedReceiptId, expenseId);
        }
        await expenseApi.submit(expenseId);
      }
      router.push('/dashboard/expenses');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isProcessing = isSaving || isSubmitting;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Page header */}
      <div>
        <Link
          href="/dashboard/expenses"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          {t.backToExpenses}
        </Link>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t.newExpense}</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t.fillDetailsInfo}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <form className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 p-6 shadow-sm space-y-5">
        
        {/* Receipt Upload logic */}
        <div className="rounded-lg flex flex-col items-center justify-center p-6 border-2 border-dashed border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-900/10 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-colors">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={handleUpload}
            className="hidden"
          />
          <div className="text-center">
            {isUploading ? (
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-500" />
            ) : uploadedReceiptId ? (
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
            ) : (
              <Upload className="mx-auto h-8 w-8 text-indigo-400" />
            )}
            
            <div className="mt-4 flex text-sm text-gray-600 justify-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="relative cursor-pointer rounded-md bg-transparent font-medium text-indigo-600 dark:text-indigo-400 focus-within:outline-none hover:text-indigo-500 dark:hover:text-indigo-300"
              >
                <span>{uploadedReceiptId ? t.uploadDifferentReceipt : t.uploadReceiptForAutoFill}</span>
              </button>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              {t.aiExtractInfo}
            </p>
          </div>
          {ocrMessage && (
            <div className="mt-5 text-sm font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/50 px-4 py-2 rounded-full inline-flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {ocrMessage}
            </div>
          )}
        </div>

        {/* Date and Amount row */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 mt-2">
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t.date}
            </label>
            <input
              id="date"
              type="date"
              {...register('expenseDate')}
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
            />
            {errors.expenseDate && (
              <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.expenseDate.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t.amount}
            </label>
            <input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              {...register('amount')}
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-gray-900 dark:text-white shadow-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
            />
            {errors.amount && (
              <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.amount.message}</p>
            )}
          </div>
        </div>

        {/* KDV (Tax) and Currency row */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div>
            <label htmlFor="taxAmount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t.kdvVat}
            </label>
            <input
              id="taxAmount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              {...register('taxAmount')}
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-gray-900 dark:text-white shadow-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="currency" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t.currency}
            </label>
            <select
              id="currency"
              {...register('currency')}
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {errors.currency && (
              <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.currency.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t.category}
            </label>
            <select
              id="category"
              {...register('category')}
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
            >
              <option value="">{t.selectCategory}</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {errors.category && (
              <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.category.message}</p>
            )}
          </div>
        </div>

        {/* Cost Center and Project Code row */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="costCenter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t.costCenter} <span className="text-gray-400 dark:text-gray-500">{t.optional}</span>
            </label>
            <input
              id="costCenter"
              type="text"
              placeholder="e.g. CC-1001"
              {...register('costCenter')}
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-gray-900 dark:text-white shadow-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="projectCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t.projectCode} <span className="text-gray-400 dark:text-gray-500">{t.optional}</span>
            </label>
            <input
              id="projectCode"
              type="text"
              placeholder="e.g. PRJ-2024-001"
              {...register('projectCode')}
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-gray-900 dark:text-white shadow-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {t.description}
          </label>
          <textarea
            id="description"
            rows={3}
            placeholder={t.describeExpense}
            {...register('description')}
            className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-gray-900 dark:text-white shadow-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm resize-none"
          />
          {errors.description && (
            <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.description.message}</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 dark:border-gray-700 pt-5">
          <Link
            href="/dashboard/expenses"
            className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            {t.cancel}
          </Link>
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleSubmit(saveAsDraft)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {t.saveDraft}
          </button>
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleSubmit(submitExpense)}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {t.submit}
          </button>
        </div>
      </form>
    </div>
  );
}

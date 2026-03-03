'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, Send, ArrowLeft, Loader2, AlertCircle, CheckCircle2, XCircle, Clock, RotateCw, Bug } from 'lucide-react';
import Link from 'next/link';
import { expenseApi } from '@/lib/api';
import { useI18nStore, useAuthStore } from '@/lib/store';
import ExpenseStatusBadge from '@/components/ExpenseStatusBadge';

const CATEGORIES = [
  'Travel',
  'Accommodation',
  'Meals',
  'Transportation',
  'Office',
  'Other',
] as const;

const CURRENCIES = ['TRY', 'USD', 'EUR', 'GBP'] as const;

const expenseSchema = z.object({
  expenseDate: z.string().min(1, 'Date is required'),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  taxAmount: z.preprocess(
    (val) => (val === '' || val === undefined || val === null ? undefined : Number(val)),
    z.number().min(0).optional(),
  ),
  currency: z.string().min(1, 'Currency is required'),
  category: z.string().min(1, 'Category is required'),
  costCenter: z.string().optional(),
  projectCode: z.string().optional(),
  description: z.string().min(1, 'Description is required').max(500, 'Description too long'),
  receiptNumber: z.string().optional(),
});

type ExpenseFormData = z.infer<typeof expenseSchema>;

interface ExpenseDetail {
  id: string;
  expenseDate: string;
  amount: number;
  taxAmount?: number;
  currency: string;
  category: string;
  status: string;
  description?: string;
  costCenter?: string;
  projectCode?: string;
  receiptNumber?: string;
  sapDocumentNumber?: string;
  sapStatus?: string;
  sapPostError?: string | null;
  sapPostSuccess?: string | null;
  user?: { name?: string; email?: string; department?: string };
}

export default function EditExpensePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { t } = useI18nStore();
  const { user: authUser } = useAuthStore();
  const isElevated = authUser?.role === 'FINANCE' || authUser?.role === 'ADMIN';

  const [fetchLoading, setFetchLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [expenseData, setExpenseData] = useState<ExpenseDetail | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sapRetrying, setSapRetrying] = useState(false);
  const [sapRetryResult, setSapRetryResult] = useState<string | null>(null);
  const [debugResult, setDebugResult] = useState<any>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
  });

  useEffect(() => {
    const fetchExpense = async () => {
      try {
        setFetchLoading(true);
        const response = await expenseApi.getById(id);
        const expense: ExpenseDetail = response.data?.data ?? response.data;
        setExpenseData(expense);
        reset({
          expenseDate: expense.expenseDate?.split('T')[0] ?? '',
          amount: expense.amount,
          taxAmount: expense.taxAmount ?? undefined,
          currency: expense.currency,
          category: expense.category,
          costCenter: expense.costCenter ?? '',
          projectCode: expense.projectCode ?? '',
          description: expense.description ?? '',
          receiptNumber: expense.receiptNumber ?? '',
        });
      } catch (err: any) {
        setFetchError(err.response?.data?.message || 'Failed to load expense');
      } finally {
        setFetchLoading(false);
      }
    };
    fetchExpense();
  }, [id, reset]);

  const saveAsDraft = async (data: ExpenseFormData) => {
    setActionError(null);
    setIsSaving(true);
    try {
      await expenseApi.update(id, data);
      router.push('/dashboard/expenses');
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Failed to save expense');
    } finally {
      setIsSaving(false);
    }
  };

  const submitExpense = async (data: ExpenseFormData) => {
    setActionError(null);
    setIsSubmitting(true);
    try {
      await expenseApi.update(id, data);
      await expenseApi.submit(id);
      router.push('/dashboard/expenses');
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Failed to submit expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isProcessing = isSaving || isSubmitting;

  if (fetchLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        <span className="ml-2 text-sm text-gray-500">{t.loadingExpense}</span>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Link
          href="/dashboard/expenses"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t.backToExpenses}
        </Link>
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {fetchError}
        </div>
      </div>
    );
  }

  // Non-DRAFT: read-only view
  if (expenseData && expenseData.status !== 'DRAFT') {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <Link
            href="/dashboard/expenses"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            {t.backToExpenses}
          </Link>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t.expenseDetails}</h2>
            <ExpenseStatusBadge status={expenseData.status} />
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t.expenseNotEditable}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 p-6 shadow-sm space-y-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t.date}</p>
              <p className="mt-1 text-sm text-gray-900 dark:text-white">
                {expenseData.expenseDate
                  ? new Date(expenseData.expenseDate).toLocaleDateString('tr-TR')
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t.amount}</p>
              <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                {new Intl.NumberFormat('tr-TR', {
                  style: 'currency',
                  currency: expenseData.currency || 'TRY',
                }).format(Number(expenseData.amount))}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t.kdvVat}</p>
              <p className="mt-1 text-sm text-gray-900 dark:text-white">
                {expenseData.taxAmount != null && Number(expenseData.taxAmount) > 0
                  ? new Intl.NumberFormat('tr-TR', {
                      style: 'currency',
                      currency: expenseData.currency || 'TRY',
                    }).format(Number(expenseData.taxAmount))
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t.category}</p>
              <p className="mt-1 text-sm text-gray-900 dark:text-white">{expenseData.category}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t.currency}</p>
              <p className="mt-1 text-sm text-gray-900 dark:text-white">{expenseData.currency}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t.costCenter}</p>
              <p className="mt-1 text-sm text-gray-900 dark:text-white">{expenseData.costCenter || '-'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t.projectCode}</p>
              <p className="mt-1 text-sm text-gray-900 dark:text-white">{expenseData.projectCode || '-'}</p>
            </div>
          </div>
          {expenseData.receiptNumber && (
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Fiş / Fatura No</p>
              <p className="mt-1 text-sm font-mono text-gray-900 dark:text-white">{expenseData.receiptNumber}</p>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t.description}</p>
            <p className="mt-1 text-sm text-gray-900 dark:text-white">{expenseData.description || '-'}</p>
          </div>
          {expenseData.sapDocumentNumber && (
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">SAP Document Number</p>
              <p className="mt-1 text-sm font-mono text-gray-900 dark:text-white">{expenseData.sapDocumentNumber}</p>
            </div>
          )}

          {/* ─── SAP Posting Panel ─── */}
          {(expenseData.sapStatus === 'OK' || expenseData.sapStatus === 'FAILED' || expenseData.sapStatus === 'PENDING') && (
            <div className={`rounded-lg border p-4 space-y-3 ${
              expenseData.sapStatus === 'OK'
                ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20'
                : expenseData.sapStatus === 'FAILED'
                ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
            }`}>
              <div className="flex items-center gap-2">
                {expenseData.sapStatus === 'OK' && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                {expenseData.sapStatus === 'FAILED' && <XCircle className="h-5 w-5 text-red-600" />}
                {expenseData.sapStatus === 'PENDING' && <Clock className="h-5 w-5 text-amber-600" />}
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t.sapPostingPanel}</h3>
              </div>

              {expenseData.sapStatus === 'OK' && (
                <div className="text-sm text-emerald-700 dark:text-emerald-300">
                  <p>{t.sapPostedOk}</p>
                  {expenseData.sapPostSuccess && (
                    <p className="mt-1 text-xs font-mono bg-white/50 dark:bg-black/20 rounded p-2 break-all">{expenseData.sapPostSuccess}</p>
                  )}
                </div>
              )}

              {expenseData.sapStatus === 'FAILED' && (
                <div className="text-sm space-y-2">
                  <p className="text-red-700 dark:text-red-300 font-medium">{t.sapPostFailed}</p>
                  {expenseData.sapPostError && (
                    <div>
                      <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">{t.sapErrorDetails}:</p>
                      <p className="text-xs font-mono bg-white/50 dark:bg-black/20 rounded p-2 break-all text-red-800 dark:text-red-200 whitespace-pre-wrap">
                        {expenseData.sapPostError}
                      </p>
                    </div>
                  )}
                  {isElevated && (
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={async () => {
                          setSapRetrying(true);
                          setSapRetryResult(null);
                          try {
                            const res = await expenseApi.retrySap(id);
                            setSapRetryResult(t.sapRetrySuccess + ' — ' + (res.data?.sapDocumentNumber || ''));
                            // Refresh
                            const response = await expenseApi.getById(id);
                            setExpenseData(response.data?.data ?? response.data);
                          } catch (err: any) {
                            // 409 ConflictException = zaten SAP'ta başarıyla gönderilmiş
                            if (err.response?.status === 409) {
                              setSapRetryResult(t.sapRetrySuccess + ' (zaten SAP\'ta)');
                            } else {
                              setSapRetryResult(t.sapRetryFailed + ': ' + (err.response?.data?.message || err.message));
                            }
                            // Her durumda yenile — status güncellenmiş olabilir
                            try {
                              const response = await expenseApi.getById(id);
                              setExpenseData(response.data?.data ?? response.data);
                            } catch (_) {}
                          } finally {
                            setSapRetrying(false);
                          }
                        }}
                        disabled={sapRetrying}
                        className="flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50 transition-colors"
                      >
                        {sapRetrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
                        {t.sapRetrySend}
                      </button>
                      <button
                        onClick={async () => {
                          setDebugResult(null);
                          try {
                            const res = await expenseApi.debugSap(id);
                            setDebugResult(res.data);
                          } catch (err: any) {
                            setDebugResult({ error: err.response?.data?.message || err.message });
                          }
                        }}
                        className="flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <Bug className="h-3.5 w-3.5" />
                        {t.sapDebugSend}
                      </button>
                    </div>
                  )}
                  {sapRetryResult && (
                    <p className={`text-xs mt-1 ${sapRetryResult.includes('başarı') || sapRetryResult.includes('Success') ? 'text-emerald-600' : 'text-red-600'}`}>
                      {sapRetryResult}
                    </p>
                  )}
                  {debugResult && (
                    <details className="mt-2">
                      <summary className="text-xs font-medium text-gray-600 dark:text-gray-400 cursor-pointer">SAP Debug Yanıtı</summary>
                      <pre className="mt-1 text-xs font-mono bg-gray-900 text-green-300 rounded p-3 overflow-x-auto max-h-80 whitespace-pre-wrap">
                        {JSON.stringify(debugResult, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {expenseData.sapStatus === 'PENDING' && (
                <div className="text-sm text-amber-700 dark:text-amber-300">
                  <p>{t.sapPostPending}</p>
                  {isElevated && (
                    <button
                      onClick={async () => {
                        setSapRetrying(true);
                        try {
                          await expenseApi.retrySap(id);
                          const response = await expenseApi.getById(id);
                          setExpenseData(response.data?.data ?? response.data);
                        } catch (err: any) {
                          if (err.response?.status === 409) {
                            // Zaten SAP'ta — yenile
                          } else {
                            setSapRetryResult(t.sapRetryFailed + ': ' + (err.response?.data?.message || err.message));
                          }
                          try {
                            const response = await expenseApi.getById(id);
                            setExpenseData(response.data?.data ?? response.data);
                          } catch (_) {}
                        } finally {
                          setSapRetrying(false);
                        }
                      }}
                      disabled={sapRetrying}
                      className="mt-2 flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50"
                    >
                      {sapRetrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
                      {t.sapRetrySend}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // DRAFT: editable form
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/dashboard/expenses"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          {t.backToExpenses}
        </Link>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t.editExpense}</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t.updateDraftDetails}
        </p>
      </div>

      {actionError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {actionError}
        </div>
      )}

      <form className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 p-6 shadow-sm space-y-5">
        {/* Date and Amount row */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
            />
            {errors.amount && (
              <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.amount.message}</p>
            )}
          </div>
        </div>

        {/* KDV, Currency and Category row */}
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
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
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

        {/* Fiş / Fatura No — sadece görüntüleme (değiştirilemez) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Fiş / Fatura No
          </label>
          <input
            type="text"
            readOnly
            value={expenseData?.receiptNumber ?? '(girilmemiş)'}
            className="block w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2.5 text-gray-500 dark:text-gray-400 sm:text-sm cursor-not-allowed"
          />
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Fiş/fatura numarası kaydedildikten sonra değiştirilemez</p>
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

        {/* Action buttons — full-width mobil stili */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-5 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/dashboard/expenses"
            className="flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 sm:w-auto"
          >
            {t.cancel}
          </Link>
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleSubmit(saveAsDraft)}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
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
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {t.submitExpense}
          </button>
        </div>
      </form>
    </div>
  );
}

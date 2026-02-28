'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, Send, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { expenseApi } from '@/lib/api';
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
  sapDocumentNumber?: string;
}

export default function EditExpensePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [fetchLoading, setFetchLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [expenseData, setExpenseData] = useState<ExpenseDetail | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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
        <span className="ml-2 text-sm text-gray-500">Loading expense...</span>
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
          Back to Expenses
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
            Back to Expenses
          </Link>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Expense Details</h2>
            <ExpenseStatusBadge status={expenseData.status} />
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            This expense cannot be edited because it is no longer in Draft status.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 p-6 shadow-sm space-y-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Date</p>
              <p className="mt-1 text-sm text-gray-900 dark:text-white">
                {expenseData.expenseDate
                  ? new Date(expenseData.expenseDate).toLocaleDateString('tr-TR')
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Amount</p>
              <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                {new Intl.NumberFormat('tr-TR', {
                  style: 'currency',
                  currency: expenseData.currency || 'TRY',
                }).format(Number(expenseData.amount))}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">KDV (VAT)</p>
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
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Category</p>
              <p className="mt-1 text-sm text-gray-900 dark:text-white">{expenseData.category}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Currency</p>
              <p className="mt-1 text-sm text-gray-900 dark:text-white">{expenseData.currency}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Cost Center</p>
              <p className="mt-1 text-sm text-gray-900 dark:text-white">{expenseData.costCenter || '-'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Project Code</p>
              <p className="mt-1 text-sm text-gray-900 dark:text-white">{expenseData.projectCode || '-'}</p>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Description</p>
            <p className="mt-1 text-sm text-gray-900 dark:text-white">{expenseData.description || '-'}</p>
          </div>
          {expenseData.sapDocumentNumber && (
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">SAP Document Number</p>
              <p className="mt-1 text-sm font-mono text-gray-900 dark:text-white">{expenseData.sapDocumentNumber}</p>
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
          Back to Expenses
        </Link>
        <h2 className="text-2xl font-bold text-gray-900">Edit Expense</h2>
        <p className="mt-1 text-sm text-gray-500">
          Update the details for this draft expense.
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
              Date
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
              Amount
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
              KDV (VAT)
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
              Currency
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
              Category
            </label>
            <select
              id="category"
              {...register('category')}
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
            >
              <option value="">Select a category</option>
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
              Cost Center <span className="text-gray-400 dark:text-gray-500">(optional)</span>
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
              Project Code <span className="text-gray-400 dark:text-gray-500">(optional)</span>
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
            Description
          </label>
          <textarea
            id="description"
            rows={3}
            placeholder="Describe the expense..."
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
            Cancel
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
            Save Draft
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
            Submit
          </button>
        </div>
      </form>
    </div>
  );
}

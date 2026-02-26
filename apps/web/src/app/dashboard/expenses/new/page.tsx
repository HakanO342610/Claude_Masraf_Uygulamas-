'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, Send, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { expenseApi } from '@/lib/api';

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
  date: z.string().min(1, 'Date is required'),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  currency: z.string().min(1, 'Currency is required'),
  category: z.string().min(1, 'Category is required'),
  costCenter: z.string().optional(),
  projectCode: z.string().optional(),
  description: z.string().min(1, 'Description is required').max(500, 'Description too long'),
});

type ExpenseFormData = z.infer<typeof expenseSchema>;

export default function NewExpensePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      currency: 'TRY',
      date: new Date().toISOString().split('T')[0],
    },
  });

  const saveAsDraft = async (data: ExpenseFormData) => {
    setError(null);
    setIsSaving(true);
    try {
      await expenseApi.create({ ...data, status: 'Draft' });
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
      const expenseId = response.data.id || response.data.data?.id;
      if (expenseId) {
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
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Expenses
        </Link>
        <h2 className="text-2xl font-bold text-gray-900">New Expense</h2>
        <p className="mt-1 text-sm text-gray-500">
          Fill in the details for your expense report.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <form className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
        {/* Date and Amount row */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1.5">
              Date
            </label>
            <input
              id="date"
              type="date"
              {...register('date')}
              className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
            />
            {errors.date && (
              <p className="mt-1.5 text-sm text-red-600">{errors.date.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1.5">
              Amount
            </label>
            <input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              {...register('amount')}
              className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
            />
            {errors.amount && (
              <p className="mt-1.5 text-sm text-red-600">{errors.amount.message}</p>
            )}
          </div>
        </div>

        {/* Currency and Category row */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-1.5">
              Currency
            </label>
            <select
              id="currency"
              {...register('currency')}
              className="block w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {errors.currency && (
              <p className="mt-1.5 text-sm text-red-600">{errors.currency.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1.5">
              Category
            </label>
            <select
              id="category"
              {...register('category')}
              className="block w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
            >
              <option value="">Select a category</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {errors.category && (
              <p className="mt-1.5 text-sm text-red-600">{errors.category.message}</p>
            )}
          </div>
        </div>

        {/* Cost Center and Project Code row */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="costCenter" className="block text-sm font-medium text-gray-700 mb-1.5">
              Cost Center <span className="text-gray-400">(optional)</span>
            </label>
            <input
              id="costCenter"
              type="text"
              placeholder="e.g. CC-1001"
              {...register('costCenter')}
              className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="projectCode" className="block text-sm font-medium text-gray-700 mb-1.5">
              Project Code <span className="text-gray-400">(optional)</span>
            </label>
            <input
              id="projectCode"
              type="text"
              placeholder="e.g. PRJ-2024-001"
              {...register('projectCode')}
              className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1.5">
            Description
          </label>
          <textarea
            id="description"
            rows={3}
            placeholder="Describe the expense..."
            {...register('description')}
            className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm resize-none"
          />
          {errors.description && (
            <p className="mt-1.5 text-sm text-red-600">{errors.description.message}</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-5">
          <Link
            href="/dashboard/expenses"
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleSubmit(saveAsDraft)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
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

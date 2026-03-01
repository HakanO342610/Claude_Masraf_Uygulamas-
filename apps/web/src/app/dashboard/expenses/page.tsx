'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  Plus,
  Loader2,
  AlertTriangle,
  Filter,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
} from 'lucide-react';
import { expenseApi } from '@/lib/api';
import { useI18nStore } from '@/lib/store';
import ExpenseStatusBadge from '@/components/ExpenseStatusBadge';

interface Expense {
  id: string;
  expenseDate: string;
  amount: number;
  taxAmount?: number;
  currency: string;
  category: string;
  status: string;
  description?: string;
  sapDocumentNumber?: string;
  costCenter?: string;
  projectCode?: string;
}

export default function ExpensesPage() {
  const { t } = useI18nStore();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const pageSize = 10;

  const STATUS_OPTIONS = [
    { value: '', label: t.allStatuses },
    { value: 'DRAFT', label: t.draft },
    { value: 'SUBMITTED', label: t.submitted },
    { value: 'MANAGER_APPROVED', label: t.managerApproved },
    { value: 'FINANCE_APPROVED', label: t.financeApproved },
    { value: 'REJECTED', label: t.rejected },
    { value: 'POSTED_TO_SAP', label: t.postedToSap },
  ];

  const totalPages = Math.ceil(expenses.length / pageSize);
  const paginatedExpenses = expenses.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
    fetchExpenses();
  }, [statusFilter, fromDate, toDate]);

  const fetchExpenses = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      const response = await expenseApi.getAll(Object.keys(params).length > 0 ? params : undefined);
      const data = Array.isArray(response.data) ? response.data : response.data.data || [];
      setExpenses(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load expenses');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await expenseApi.delete(deleteTarget);
      setExpenses((prev) => prev.filter((e) => e.id !== deleteTarget));
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Delete failed';
      alert(msg);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t.expenses}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t.manageExpenses}</p>
        </div>
        <Link
          href="/dashboard/expenses/new"
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500"
        >
          <Plus className="h-4 w-4" />
          {t.newExpense}
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{t.filter}:</span>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-400" />
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
          />
          <span className="text-sm text-gray-400">-</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
          />
        </div>

        {(statusFilter || fromDate || toDate) && (
          <button
            onClick={() => {
              setStatusFilter('');
              setFromDate('');
              setToDate('');
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400"
          >
            {t.clearFilters}
          </button>
        )}
      </div>

      {/* Expenses table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            <span className="ml-2 text-sm text-gray-500">{t.loading}</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-red-600">
            <AlertTriangle className="h-5 w-5" />
            {error}
          </div>
        ) : expenses.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-gray-500">{t.noData}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-700/50">
                  <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">{t.date}</th>
                  <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">{t.description}</th>
                  <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">{t.amount}</th>
                  <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">{t.kdv}</th>
                  <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">{t.category}</th>
                  <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">{t.costCenter}</th>
                  <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">{t.status}</th>
                  <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">{t.sapDoc}</th>
                  <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">{t.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {paginatedExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50 transition-colors dark:hover:bg-gray-700/50">
                    <td className="px-6 py-3.5 text-gray-900 dark:text-gray-200">
                      {format(new Date(expense.expenseDate), 'dd MMM yyyy')}
                    </td>
                    <td className="px-6 py-3.5 text-gray-600 max-w-xs truncate dark:text-gray-300">
                      {expense.description || '-'}
                    </td>
                    <td className="px-6 py-3.5 font-medium text-gray-900 dark:text-gray-200">
                      {new Intl.NumberFormat('tr-TR', {
                        style: 'currency',
                        currency: expense.currency || 'TRY',
                      }).format(Number(expense.amount))}
                    </td>
                    <td className="px-6 py-3.5 text-gray-500 text-xs dark:text-gray-400">
                      {expense.taxAmount != null && Number(expense.taxAmount) > 0
                        ? new Intl.NumberFormat('tr-TR', {
                            style: 'currency',
                            currency: expense.currency || 'TRY',
                          }).format(Number(expense.taxAmount))
                        : '-'}
                    </td>
                    <td className="px-6 py-3.5 text-gray-600 dark:text-gray-300">{expense.category}</td>
                    <td className="px-6 py-3.5 text-gray-500 dark:text-gray-400">{expense.costCenter || '-'}</td>
                    <td className="px-6 py-3.5">
                      <ExpenseStatusBadge status={expense.status} />
                    </td>
                    <td className="px-6 py-3.5 text-gray-500 dark:text-gray-400">
                      {expense.sapDocumentNumber || '-'}
                    </td>
                    <td className="px-6 py-3.5">
                      {expense.status === 'DRAFT' && (
                        <div className="flex items-center gap-1">
                          <Link
                            href={`/dashboard/expenses/${expense.id}`}
                            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            {t.edit}
                          </Link>
                          <button
                            onClick={() => setDeleteTarget(expense.id)}
                            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {t.deleteExpense}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && !error && expenses.length > pageSize && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {t.showing} {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, expenses.length)} / {expenses.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-lg border border-gray-300 bg-white p-2 text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  page === currentPage
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded-lg border border-gray-300 bg-white p-2 text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-800">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t.deleteExpense}</h3>
            </div>
            <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">{t.deleteConfirm}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                {t.cancel}
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? t.deleting : t.deleteExpense}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

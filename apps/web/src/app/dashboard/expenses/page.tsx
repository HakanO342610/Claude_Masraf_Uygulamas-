'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  Plus,
  Loader2,
  AlertTriangle,
  Filter,
} from 'lucide-react';
import { expenseApi } from '@/lib/api';
import ExpenseStatusBadge from '@/components/ExpenseStatusBadge';

interface Expense {
  id: string;
  date: string;
  amount: number;
  currency: string;
  category: string;
  status: string;
  description?: string;
  sapDocumentNumber?: string;
  costCenter?: string;
  projectCode?: string;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'Draft', label: 'Draft' },
  { value: 'Submitted', label: 'Submitted' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'PostedToSAP', label: 'Posted to SAP' },
];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchExpenses();
  }, [statusFilter]);

  const fetchExpenses = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = statusFilter ? { status: statusFilter } : undefined;
      const response = await expenseApi.getAll(params);
      const data = Array.isArray(response.data) ? response.data : response.data.data || [];
      setExpenses(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load expenses');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Expenses</h2>
          <p className="mt-1 text-sm text-gray-500">Manage all your expense reports</p>
        </div>
        <Link
          href="/dashboard/expenses/new"
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500"
        >
          <Plus className="h-4 w-4" />
          New Expense
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-600">Filter:</span>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Expenses table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            <span className="ml-2 text-sm text-gray-500">Loading expenses...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-red-600">
            <AlertTriangle className="h-5 w-5" />
            {error}
          </div>
        ) : expenses.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-gray-500">
              {statusFilter
                ? `No expenses with status "${statusFilter}" found.`
                : 'No expenses found. Create your first expense report.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-6 py-3 font-medium text-gray-500">Date</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Description</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Amount</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Category</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Cost Center</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Status</th>
                  <th className="px-6 py-3 font-medium text-gray-500">SAP Doc</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3.5 text-gray-900">
                      {format(new Date(expense.date), 'dd MMM yyyy')}
                    </td>
                    <td className="px-6 py-3.5 text-gray-600 max-w-xs truncate">
                      {expense.description || '-'}
                    </td>
                    <td className="px-6 py-3.5 font-medium text-gray-900">
                      {new Intl.NumberFormat('tr-TR', {
                        style: 'currency',
                        currency: expense.currency || 'TRY',
                      }).format(expense.amount)}
                    </td>
                    <td className="px-6 py-3.5 text-gray-600">{expense.category}</td>
                    <td className="px-6 py-3.5 text-gray-500">{expense.costCenter || '-'}</td>
                    <td className="px-6 py-3.5">
                      <ExpenseStatusBadge status={expense.status} />
                    </td>
                    <td className="px-6 py-3.5 text-gray-500">
                      {expense.sapDocumentNumber || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

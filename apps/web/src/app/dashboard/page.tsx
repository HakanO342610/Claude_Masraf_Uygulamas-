'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  Loader2,
  AlertTriangle,
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
  sapDocumentNumber?: string;
  description?: string;
}

interface SummaryCard {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

export default function DashboardPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      setIsLoading(true);
      const response = await expenseApi.getAll();
      const data = Array.isArray(response.data) ? response.data : response.data.data || [];
      setExpenses(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load expenses');
    } finally {
      setIsLoading(false);
    }
  };

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlyExpenses = expenses.filter((e) => {
    const d = new Date(e.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const totalThisMonth = monthlyExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const pendingCount = expenses.filter((e) => e.status === 'Submitted').length;
  const approvedCount = expenses.filter((e) => e.status === 'Approved' || e.status === 'PostedToSAP').length;
  const rejectedCount = expenses.filter((e) => e.status === 'Rejected').length;

  const summaryCards: SummaryCard[] = [
    {
      title: 'Total This Month',
      value: new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(totalThisMonth),
      icon: DollarSign,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      title: 'Pending',
      value: pendingCount,
      icon: Clock,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Approved',
      value: approvedCount,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Rejected',
      value: rejectedCount,
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
  ];

  const recentExpenses = [...expenses]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="mt-1 text-sm text-gray-500">Overview of your expense reports</p>
        </div>
        <Link
          href="/dashboard/expenses/new"
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500"
        >
          <Plus className="h-4 w-4" />
          New Expense
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.title}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">{card.title}</p>
              <div className={`rounded-lg p-2 ${card.bgColor}`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Recent expenses table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Expenses</h3>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            <span className="ml-2 text-sm text-gray-500">Loading expenses...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-red-600">
            <AlertTriangle className="h-5 w-5" />
            {error}
          </div>
        ) : recentExpenses.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-500">No expenses found. Create your first expense report.</p>
            <Link
              href="/dashboard/expenses/new"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              <Plus className="h-4 w-4" />
              Create Expense
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-6 py-3 font-medium text-gray-500">Date</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Amount</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Category</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Status</th>
                  <th className="px-6 py-3 font-medium text-gray-500">SAP Doc</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3.5 text-gray-900">
                      {format(new Date(expense.date), 'dd MMM yyyy')}
                    </td>
                    <td className="px-6 py-3.5 font-medium text-gray-900">
                      {new Intl.NumberFormat('tr-TR', {
                        style: 'currency',
                        currency: expense.currency || 'TRY',
                      }).format(expense.amount)}
                    </td>
                    <td className="px-6 py-3.5 text-gray-600">{expense.category}</td>
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

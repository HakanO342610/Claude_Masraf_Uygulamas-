'use client';

import { useEffect, useState } from 'react';
import { Loader2, AlertTriangle, TrendingUp, DollarSign, Layers, Building2, Download } from 'lucide-react';
import { reportsApi } from '@/lib/api';

interface CategoryData {
  category: string;
  count: number;
  totalAmount: number;
  percentage: number;
}

interface DepartmentData {
  department: string;
  count: number;
  totalAmount: number;
}

interface MonthlyData {
  month: number;
  monthName: string;
  count: number;
  totalAmount: number;
}

interface Summary {
  totalExpenses: number;
  totalAmount: number;
  averageAmount: number;
  maxAmount: number;
  byCategory: { category: string; count: number; totalAmount: number }[];
  byStatus: { status: string; count: number }[];
}

export default function ReportsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [departmentData, setDepartmentData] = useState<DepartmentData[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {
        ...(fromDate && { from: fromDate }),
        ...(toDate && { to: toDate }),
      };

      const [summaryRes, categoryRes, departmentRes, monthlyRes] =
        await Promise.all([
          reportsApi.getSummary(params),
          reportsApi.getByCategory(params),
          reportsApi.getByDepartment(params),
          reportsApi.getMonthly(),
        ]);

      setSummary(summaryRes.data);
      setCategoryData(categoryRes.data);
      setDepartmentData(departmentRes.data);
      setMonthlyData(monthlyRes.data?.months || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load reports');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const params = {
        ...(fromDate && { from: fromDate }),
        ...(toDate && { to: toDate }),
      };
      const response = await reportsApi.exportCsv(params);
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `expenses-report-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Failed to export CSV');
    } finally {
      setIsExporting(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        <span className="ml-2 text-sm text-gray-500">Loading reports...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-red-600">
        <AlertTriangle className="h-5 w-5" />
        {error}
      </div>
    );
  }

  const maxMonthlyAmount = Math.max(...monthlyData.map((m) => m.totalAmount), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Reports</h2>
          <p className="mt-1 text-sm text-gray-500">Expense analytics and insights</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="From"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="To"
          />
          <button
            onClick={fetchReports}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Apply
          </button>
          <button
            onClick={handleExportCsv}
            disabled={isExporting}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {isExporting ? 'Exporting...' : 'CSV'}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="Total Expenses"
            value={summary.totalExpenses.toString()}
            icon={Layers}
            color="text-indigo-600"
            bgColor="bg-indigo-50"
          />
          <SummaryCard
            title="Total Amount"
            value={formatCurrency(Number(summary.totalAmount))}
            icon={DollarSign}
            color="text-emerald-600"
            bgColor="bg-emerald-50"
          />
          <SummaryCard
            title="Average Amount"
            value={formatCurrency(Number(summary.averageAmount))}
            icon={TrendingUp}
            color="text-blue-600"
            bgColor="bg-blue-50"
          />
          <SummaryCard
            title="Highest Expense"
            value={formatCurrency(Number(summary.maxAmount))}
            icon={DollarSign}
            color="text-orange-600"
            bgColor="bg-orange-50"
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Category breakdown */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">By Category</h3>
          {categoryData.length === 0 ? (
            <p className="text-sm text-gray-500">No data available</p>
          ) : (
            <div className="space-y-3">
              {categoryData.map((item) => (
                <div key={item.category}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">{item.category}</span>
                    <span className="text-gray-500">
                      {formatCurrency(Number(item.totalAmount))} ({item.count})
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full bg-indigo-500"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Department breakdown */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">By Department</h3>
          {departmentData.length === 0 ? (
            <p className="text-sm text-gray-500">No data available</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="py-2 text-left font-medium text-gray-500">Department</th>
                  <th className="py-2 text-right font-medium text-gray-500">Count</th>
                  <th className="py-2 text-right font-medium text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody>
                {departmentData.map((item) => (
                  <tr key={item.department} className="border-b border-gray-50">
                    <td className="py-2.5 font-medium text-gray-700">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        {item.department}
                      </div>
                    </td>
                    <td className="py-2.5 text-right text-gray-500">{item.count}</td>
                    <td className="py-2.5 text-right font-medium text-gray-900">
                      {formatCurrency(item.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Monthly trend */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Trend</h3>
        {monthlyData.length === 0 ? (
          <p className="text-sm text-gray-500">No data available</p>
        ) : (
          <div className="flex items-end gap-2" style={{ height: 200 }}>
            {monthlyData.map((month) => {
              const height =
                maxMonthlyAmount > 0
                  ? (month.totalAmount / maxMonthlyAmount) * 100
                  : 0;
              return (
                <div
                  key={month.month}
                  className="flex flex-1 flex-col items-center gap-1"
                >
                  <span className="text-xs text-gray-500">
                    {month.totalAmount > 0 ? formatCurrency(month.totalAmount) : ''}
                  </span>
                  <div
                    className="w-full rounded-t bg-indigo-500 transition-all"
                    style={{ height: `${Math.max(height, 2)}%` }}
                  />
                  <span className="text-xs font-medium text-gray-600">
                    {month.monthName}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  color,
  bgColor,
}: {
  title: string;
  value: string;
  icon: any;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <div className={`rounded-lg p-2 ${bgColor}`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

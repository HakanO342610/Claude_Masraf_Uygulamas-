'use client';

import { useEffect, useState } from 'react';
import {
  Loader2,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  AlertOctagon,
  RotateCcw,
  Zap,
  Eye,
} from 'lucide-react';
import Link from 'next/link';
import { sapApi } from '@/lib/api';
import { useI18nStore } from '@/lib/store';

interface QueueItem {
  id: string;
  expenseId: string;
  status: string;
  attempts: number;
  lastError: string | null;
  nextRetry: string | null;
  createdAt: string;
  updatedAt: string;
  expense?: {
    id: string;
    category: string;
    amount: number;
    currency?: string;
    description?: string;
    receiptNumber?: string;
    user?: { name: string };
  };
}

interface QueueStatus {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  deadLetter: number;
  items: QueueItem[];
}

const statusConfig: Record<string, { icon: any; color: string; bg: string; darkBg: string }> = {
  PENDING:     { icon: Clock,         color: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-50',   darkBg: 'dark:bg-amber-900/20' },
  PROCESSING:  { icon: Loader2,       color: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-50',    darkBg: 'dark:bg-blue-900/20' },
  COMPLETED:   { icon: CheckCircle2,  color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50', darkBg: 'dark:bg-emerald-900/20' },
  FAILED:      { icon: XCircle,       color: 'text-red-600 dark:text-red-400',         bg: 'bg-red-50',     darkBg: 'dark:bg-red-900/20' },
  DEAD_LETTER: { icon: AlertOctagon,  color: 'text-gray-600 dark:text-gray-400',       bg: 'bg-gray-100',   darkBg: 'dark:bg-gray-700' },
};

export default function SapQueuePage() {
  const t = useI18nStore((state) => state.t);

  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  useEffect(() => {
    fetchQueue();
    // Otomatik yenileme — 30 saniye
    const interval = setInterval(fetchQueue, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchQueue = async () => {
    try {
      const res = await sapApi.getQueueStatus();
      setQueueStatus(res.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || t.failedLoadSapQueue);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = async (id: string) => {
    setRetryingId(id);
    try {
      await sapApi.retryQueueItem(id);
      await fetchQueue();
    } catch (err: any) {
      setError(err.response?.data?.message || t.retryFailed);
    } finally {
      setRetryingId(null);
    }
  };

  const handleSync = async () => {
    try {
      await sapApi.syncMasterData();
      alert(t.masterDataSyncTriggered);
    } catch (err: any) {
      setError(err.response?.data?.message || t.syncFailed);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">{t.loadSapQueue}</span>
      </div>
    );
  }

  if (error && !queueStatus) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-red-600 dark:text-red-400">
        <AlertTriangle className="h-5 w-5" />
        {error}
      </div>
    );
  }

  const stats = [
    { label: t.pending,    value: queueStatus?.pending || 0,    color: 'text-amber-600 dark:text-amber-400',     icon: Clock },
    { label: t.processing, value: queueStatus?.processing || 0, color: 'text-blue-600 dark:text-blue-400',       icon: Zap },
    { label: t.completed,  value: queueStatus?.completed || 0,  color: 'text-emerald-600 dark:text-emerald-400', icon: CheckCircle2 },
    { label: t.failed,     value: queueStatus?.failed || 0,     color: 'text-red-600 dark:text-red-400',         icon: XCircle },
    { label: t.deadLetter, value: queueStatus?.deadLetter || 0, color: 'text-gray-600 dark:text-gray-400',       icon: AlertOctagon },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t.sapIntegrationQueue}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t.monitorManageSapQueue}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSync}
            className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            {t.syncMasterData}
          </button>
          <button
            onClick={fetchQueue}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            {t.refresh}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 p-4 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${stat.color}`} />
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.label}</p>
              </div>
              <p className={`mt-1 text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Queue items table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-100 dark:border-gray-700 px-6 py-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t.queueItems}</h3>
        </div>
        {!queueStatus?.items?.length ? (
          <div className="px-6 py-12 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400 dark:text-emerald-600 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">{t.noItemsInQueue}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Tamamlanan öğeler burada gösterilmez
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/50">
                  <th className="px-6 py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t.status}</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t.expenseTitle}</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t.employee}</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t.amount}</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t.attempts}</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t.error}</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t.nextRetry}</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500 dark:text-gray-400">{t.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {queueStatus.items.map((item) => {
                  const cfg = statusConfig[item.status] || statusConfig.PENDING;
                  const Icon = cfg.icon;
                  return (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.darkBg} ${cfg.color}`}
                        >
                          <Icon className={`h-3 w-3 ${item.status === 'PROCESSING' ? 'animate-spin' : ''}`} />
                          {item.status === 'DEAD_LETTER' ? t.deadLetter :
                           item.status === 'PENDING' ? t.pending :
                           item.status === 'PROCESSING' ? t.processing :
                           item.status === 'COMPLETED' ? t.completed :
                           item.status === 'FAILED' ? t.failed : item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-gray-900 dark:text-gray-200 font-medium">
                          {item.expense?.description || item.expense?.category || '-'}
                        </div>
                        {item.expense?.receiptNumber && (
                          <div className="text-xs text-gray-400 font-mono mt-0.5">
                            #{item.expense.receiptNumber}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                        {item.expense?.user?.name || '-'}
                      </td>
                      <td className="px-6 py-4 text-gray-900 dark:text-gray-200 font-medium">
                        {item.expense?.amount
                          ? new Intl.NumberFormat('tr-TR', {
                              style: 'currency',
                              currency: item.expense?.currency || 'TRY',
                            }).format(Number(item.expense.amount))
                          : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-sm font-medium ${
                          item.attempts >= 5 ? 'text-red-600 dark:text-red-400' :
                          item.attempts >= 3 ? 'text-amber-600 dark:text-amber-400' :
                          'text-gray-600 dark:text-gray-300'
                        }`}>
                          {item.attempts}/5
                        </span>
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        {item.lastError ? (
                          <details className="group">
                            <summary className="text-xs text-red-600 dark:text-red-400 cursor-pointer truncate max-w-[200px]">
                              {item.lastError.substring(0, 60)}...
                            </summary>
                            <p className="mt-1 text-xs text-red-500 dark:text-red-300 whitespace-pre-wrap font-mono bg-red-50 dark:bg-red-900/20 p-2 rounded">
                              {item.lastError}
                            </p>
                          </details>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-xs">
                        {item.nextRetry
                          ? new Date(item.nextRetry).toLocaleString('tr-TR')
                          : '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/dashboard/expenses/${item.expenseId}`}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            title={t.expenseDetails}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
                          {(item.status === 'FAILED' || item.status === 'DEAD_LETTER') && (
                            <button
                              onClick={() => handleRetry(item.id)}
                              disabled={retryingId === item.id}
                              className="inline-flex items-center gap-1 rounded-md border border-gray-300 dark:border-gray-600 px-2.5 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-50 transition-colors"
                            >
                              {retryingId === item.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3 w-3" />
                              )}
                              {t.retry}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bilgi footer */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-900/20 p-4 text-sm text-blue-700 dark:text-blue-300">
        <p className="font-medium mb-1">ℹ️ SAP Kuyruk Bilgisi</p>
        <ul className="list-disc list-inside space-y-1 text-xs text-blue-600 dark:text-blue-400">
          <li>Finance onayından sonra masraflar otomatik olarak kuyruğa eklenir</li>
          <li>İlk gönderim hemen yapılır, başarısız olursa 2-4-8-16 dk aralıklarla tekrar denenir</li>
          <li>5 başarısız denemeden sonra öğe &quot;Geçersiz&quot; durumuna düşer — manuel müdahale gerekir</li>
          <li>Sayfa her 30 saniyede otomatik yenilenir</li>
        </ul>
      </div>
    </div>
  );
}

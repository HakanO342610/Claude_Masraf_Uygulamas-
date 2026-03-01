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
} from 'lucide-react';
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
    category: string;
    amount: number;
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

const statusConfig: Record<string, { icon: any; color: string; bg: string }> = {
  PENDING: { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
  PROCESSING: { icon: Loader2, color: 'text-blue-600', bg: 'bg-blue-50' },
  COMPLETED: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  FAILED: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
  DEAD_LETTER: { icon: AlertOctagon, color: 'text-gray-600', bg: 'bg-gray-100' },
};

export default function SapQueuePage() {
  const t = useI18nStore((state) => state.t);
  
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    setIsLoading(true);
    try {
      const res = await sapApi.getQueueStatus();
      setQueueStatus(res.data);
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
        <span className="ml-2 text-sm text-gray-500">{t.loadSapQueue}</span>
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

  const stats = [
    { label: t.pending, value: queueStatus?.pending || 0, color: 'text-amber-600' },
    { label: t.processing, value: queueStatus?.processing || 0, color: 'text-blue-600' },
    { label: t.completed, value: queueStatus?.completed || 0, color: 'text-emerald-600' },
    { label: t.failed, value: queueStatus?.failed || 0, color: 'text-red-600' },
    { label: t.deadLetter, value: queueStatus?.deadLetter || 0, color: 'text-gray-600' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t.sapIntegrationQueue}</h2>
          <p className="mt-1 text-sm text-gray-500">
            {t.monitorManageSapQueue}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSync}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            {t.syncMasterData}
          </button>
          <button
            onClick={fetchQueue}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            <RefreshCw className="h-4 w-4" />
            {t.refresh}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <p className="text-sm font-medium text-gray-500">{stat.label}</p>
            <p className={`mt-1 text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-3">
          <h3 className="text-sm font-semibold text-gray-900">{t.queueItems}</h3>
        </div>
        {!queueStatus?.items?.length ? (
          <div className="px-6 py-8 text-center text-sm text-gray-500">
            {t.noItemsInQueue}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-3 text-left font-medium text-gray-500">{t.status}</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">{t.expenseTitle}</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">{t.attempts}</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">{t.error}</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">{t.nextRetry}</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500">{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {queueStatus.items.map((item) => {
                const cfg = statusConfig[item.status] || statusConfig.PENDING;
                const Icon = cfg.icon;
                return (
                  <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}
                      >
                        <Icon className="h-3 w-3" />
                        {item.status === 'DEAD_LETTER' ? t.deadLetter : 
                         item.status === 'PENDING' ? t.pending :
                         item.status === 'PROCESSING' ? t.processing : 
                         item.status === 'COMPLETED' ? t.completed : 
                         item.status === 'FAILED' ? t.failed : item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {(item.expense?.category ? (t[`cat_${item.expense.category.replace(/[&\s]/g, '_')}` as keyof typeof t] || item.expense.category) : '') || item.expenseId.slice(0, 8)}
                    </td>
                    <td className="px-6 py-4 text-gray-500">{item.attempts}/3</td>
                    <td className="px-6 py-4">
                      {item.lastError ? (
                        <span className="text-xs text-red-600 truncate block max-w-xs">
                          {item.lastError}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {item.nextRetry
                        ? new Date(item.nextRetry).toLocaleString('tr-TR')
                        : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {(item.status === 'FAILED' || item.status === 'DEAD_LETTER') && (
                        <button
                          onClick={() => handleRetry(item.id)}
                          disabled={retryingId === item.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          {retryingId === item.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3 w-3" />
                          )}
                          {t.retry}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  MessageSquare,
  FileText,
  Building2,
  FolderOpen,
} from 'lucide-react';
import { expenseApi } from '@/lib/api';
import { useI18nStore } from '@/lib/store';
import ExpenseStatusBadge from '@/components/ExpenseStatusBadge';

interface Approval {
  id: string;
  expenseDate: string;
  amount: number;
  currency: string;
  category: string;
  status: string;
  description?: string;
  costCenter?: string;
  projectCode?: string;
  receiptUrl?: string;
  user?: { name: string; email: string; department?: string };
}

export default function ApprovalsPage() {
  const { t } = useI18nStore();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchApprovals();
  }, []);

  const fetchApprovals = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await expenseApi.getPendingApprovals();
      const rawData = Array.isArray(response.data) ? response.data : response.data.data || [];
      const mappedApprovals = rawData.map((d: any) => d.expense ? d.expense : d);
      setApprovals(mappedApprovals);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load pending approvals');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      await expenseApi.approve(id, comments[id]);
      setApprovals((prev) => prev.filter((a) => a.id !== id));
      setComments((prev) => { const copy = { ...prev }; delete copy[id]; return copy; });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to approve expense');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    const comment = comments[id]?.trim();
    if (!comment) {
      setError(t.rejectCommentRequired);
      return;
    }
    setProcessingId(id);
    try {
      await expenseApi.reject(id, comment);
      setApprovals((prev) => prev.filter((a) => a.id !== id));
      setComments((prev) => { const copy = { ...prev }; delete copy[id]; return copy; });
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reject expense');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t.approvals}</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t.reviewApprovals}</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">&times;</button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          <span className="ml-2 text-sm text-gray-500">{t.loading}</span>
        </div>
      ) : approvals.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <CheckCircle className="mx-auto h-10 w-10 text-green-400" />
          <p className="mt-3 text-sm font-medium text-gray-900 dark:text-white">{t.allCaughtUp}</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t.noPendingApprovals}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map((approval) => (
            <div key={approval.id} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                      {approval.category} {t.expenses}
                    </h3>
                    <ExpenseStatusBadge status={approval.status} />
                  </div>

                  {approval.user && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t.submittedBy}{' '}
                      <span className="font-medium text-gray-700 dark:text-gray-200">
                        {approval.user.name || approval.user.email}
                      </span>
                      {approval.user.department && (
                        <span className="text-gray-400"> - {approval.user.department}</span>
                      )}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600 dark:text-gray-300">
                    <span>
                      <span className="text-gray-400">{t.date}:</span>{' '}
                      {format(new Date(approval.expenseDate), 'dd MMM yyyy')}
                    </span>
                    <span>
                      <span className="text-gray-400">{t.amount}:</span>{' '}
                      <span className="font-medium text-gray-900 dark:text-white">
                        {new Intl.NumberFormat('tr-TR', {
                          style: 'currency',
                          currency: approval.currency || 'TRY',
                        }).format(approval.amount)}
                      </span>
                    </span>
                    {approval.costCenter && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5 text-gray-400" />
                        <span className="text-gray-400">{t.costCenter}:</span> {approval.costCenter}
                      </span>
                    )}
                    {approval.projectCode && (
                      <span className="flex items-center gap-1">
                        <FolderOpen className="h-3.5 w-3.5 text-gray-400" />
                        <span className="text-gray-400">{t.projectCode}:</span> {approval.projectCode}
                      </span>
                    )}
                  </div>

                  {approval.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{approval.description}</p>
                  )}

                  {approval.receiptUrl && (
                    <div className="mt-2">
                      <a
                        href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/${approval.receiptUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        {t.viewReceipt}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-700">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1.5">
                      <MessageSquare className="h-3.5 w-3.5" />
                      {t.comment}
                    </label>
                    <input
                      type="text"
                      placeholder={t.commentPlaceholder}
                      value={comments[approval.id] || ''}
                      onChange={(e) => setComments((prev) => ({ ...prev, [approval.id]: e.target.value }))}
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReject(approval.id)}
                      disabled={processingId === approval.id}
                      className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {processingId === approval.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                      {t.reject}
                    </button>
                    <button
                      onClick={() => handleApprove(approval.id)}
                      disabled={processingId === approval.id}
                      className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {processingId === approval.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                      {t.approve}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

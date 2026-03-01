'use client';

import { useEffect, useState, useRef } from 'react';
import {
  Upload,
  FileText,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Paperclip,
} from 'lucide-react';
import { receiptsApi, expenseApi } from '@/lib/api';
import { useI18nStore } from '@/lib/store';

interface Receipt {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  ocrStatus: string;
  ocrData: any;
  expenseId: string | null;
  createdAt: string;
}

interface Expense {
  id: string;
  category: string;
  amount: number;
  status: string;
  description: string;
}

export default function ReceiptsPage() {
  const { t } = useI18nStore();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [receiptsRes, expensesRes] = await Promise.all([
        receiptsApi.getMyReceipts(),
        expenseApi.getAll({ status: 'DRAFT' }),
      ]);
      setReceipts(receiptsRes.data);
      setExpenses(expensesRes.data);
    } catch {
      setError('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await receiptsApi.upload(file);
      setSuccessMsg(t.receiptUploadedSuccess);
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.message || t.uploadFailed);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAttach = async (receiptId: string, expenseId: string) => {
    try {
      await receiptsApi.attachToExpense(receiptId, expenseId);
      setSuccessMsg(t.receiptAttachedOk);
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to attach receipt');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const ocrStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'PROCESSING': return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'FAILED': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-amber-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        <span className="ml-2 text-sm text-gray-500">{t.loading}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t.receipts}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t.uploadManage}</p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={handleUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {isUploading ? (
              <><Loader2 className="h-4 w-4 animate-spin" />{t.uploading}</>
            ) : (
              <><Upload className="h-4 w-4" />{t.uploadReceiptBtn}</>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" />{error}
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />{successMsg}
        </div>
      )}

      {receipts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 py-16">
          <FileText className="h-12 w-12 text-gray-300" />
          <p className="mt-4 text-sm font-medium text-gray-600">{t.noReceiptsYet}</p>
          <p className="mt-1 text-xs text-gray-400">JPEG, PNG, WebP veya PDF (max 5MB)</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="px-6 py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t.file}</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t.size}</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t.ocrStatusLabel}</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t.ocrDataLabel}</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t.expenses}</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t.date}</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((receipt) => (
                <tr key={receipt.id} className="border-b border-gray-50 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-gray-700 dark:text-gray-200">{receipt.fileName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{formatSize(receipt.fileSize)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      {ocrStatusIcon(receipt.ocrStatus)}
                      <span className="text-gray-600 dark:text-gray-300">{receipt.ocrStatus}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                    {receipt.ocrData ? (
                      <div className="text-xs space-y-0.5">
                        {receipt.ocrData.vendor && <div>Vendor: {receipt.ocrData.vendor}</div>}
                        {receipt.ocrData.amount && <div>{t.amount}: {receipt.ocrData.amount}</div>}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4">
                    {receipt.expenseId ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                        <Paperclip className="h-3 w-3" />{t.attached}
                      </span>
                    ) : (
                      <select
                        onChange={(e) => { if (e.target.value) handleAttach(receipt.id, e.target.value); }}
                        defaultValue=""
                        className="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                      >
                        <option value="" disabled>{t.attachToExpense}</option>
                        {expenses.map((exp) => (
                          <option key={exp.id} value={exp.id}>
                            {exp.category} - {exp.description || exp.id.slice(0, 8)}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                    {new Date(receipt.createdAt).toLocaleDateString('tr-TR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

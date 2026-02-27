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
      setSuccessMsg('Receipt uploaded successfully');
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAttach = async (receiptId: string, expenseId: string) => {
    try {
      await receiptsApi.attachToExpense(receiptId, expenseId);
      setSuccessMsg('Receipt attached to expense');
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
      case 'COMPLETED':
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'PROCESSING':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-amber-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        <span className="ml-2 text-sm text-gray-500">Loading receipts...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Receipts</h2>
          <p className="mt-1 text-sm text-gray-500">
            Upload and manage your receipts
          </p>
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
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload Receipt
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          {successMsg}
        </div>
      )}

      {receipts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 py-16">
          <FileText className="h-12 w-12 text-gray-300" />
          <p className="mt-4 text-sm font-medium text-gray-600">
            No receipts uploaded yet
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Upload JPEG, PNG, WebP or PDF files (max 5MB)
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-3 text-left font-medium text-gray-500">
                  File
                </th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">
                  Size
                </th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">
                  OCR Status
                </th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">
                  OCR Data
                </th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">
                  Expense
                </th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((receipt) => (
                <tr
                  key={receipt.id}
                  className="border-b border-gray-50 hover:bg-gray-50"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-gray-700">
                        {receipt.fileName}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {formatSize(receipt.fileSize)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      {ocrStatusIcon(receipt.ocrStatus)}
                      <span className="text-gray-600">{receipt.ocrStatus}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {receipt.ocrData ? (
                      <div className="text-xs space-y-0.5">
                        {receipt.ocrData.vendor && (
                          <div>Vendor: {receipt.ocrData.vendor}</div>
                        )}
                        {receipt.ocrData.amount && (
                          <div>Amount: {receipt.ocrData.amount}</div>
                        )}
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {receipt.expenseId ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                        <Paperclip className="h-3 w-3" />
                        Attached
                      </span>
                    ) : (
                      <select
                        onChange={(e) => {
                          if (e.target.value) handleAttach(receipt.id, e.target.value);
                        }}
                        defaultValue=""
                        className="rounded border border-gray-300 px-2 py-1 text-xs"
                      >
                        <option value="" disabled>
                          Attach to expense...
                        </option>
                        {expenses.map((exp) => (
                          <option key={exp.id} value={exp.id}>
                            {exp.category} - {exp.description || exp.id.slice(0, 8)}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
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

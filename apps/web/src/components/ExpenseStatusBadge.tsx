'use client';

import { clsx } from 'clsx';

type ExpenseStatus = 'DRAFT' | 'SUBMITTED' | 'MANAGER_APPROVED' | 'FINANCE_APPROVED' | 'REJECTED' | 'POSTED_TO_SAP';

const statusStyles: Record<ExpenseStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 ring-gray-300',
  SUBMITTED: 'bg-orange-50 text-orange-700 ring-orange-300',
  MANAGER_APPROVED: 'bg-blue-50 text-blue-700 ring-blue-300',
  FINANCE_APPROVED: 'bg-green-50 text-green-700 ring-green-300',
  REJECTED: 'bg-red-50 text-red-700 ring-red-300',
  POSTED_TO_SAP: 'bg-purple-50 text-purple-700 ring-purple-300',
};

const statusLabels: Record<ExpenseStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  MANAGER_APPROVED: 'Manager Approved',
  FINANCE_APPROVED: 'Finance Approved',
  REJECTED: 'Rejected',
  POSTED_TO_SAP: 'Posted to SAP',
};

interface ExpenseStatusBadgeProps {
  status: string;
}

export default function ExpenseStatusBadge({ status }: ExpenseStatusBadgeProps) {
  const validStatus = (Object.keys(statusStyles).includes(status) ? status : 'DRAFT') as ExpenseStatus;

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        statusStyles[validStatus],
      )}
    >
      {statusLabels[validStatus]}
    </span>
  );
}

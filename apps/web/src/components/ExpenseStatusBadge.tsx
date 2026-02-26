'use client';

import { clsx } from 'clsx';

type ExpenseStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'PostedToSAP';

const statusStyles: Record<ExpenseStatus, string> = {
  Draft: 'bg-gray-100 text-gray-700 ring-gray-300',
  Submitted: 'bg-blue-50 text-blue-700 ring-blue-300',
  Approved: 'bg-green-50 text-green-700 ring-green-300',
  Rejected: 'bg-red-50 text-red-700 ring-red-300',
  PostedToSAP: 'bg-purple-50 text-purple-700 ring-purple-300',
};

const statusLabels: Record<ExpenseStatus, string> = {
  Draft: 'Draft',
  Submitted: 'Submitted',
  Approved: 'Approved',
  Rejected: 'Rejected',
  PostedToSAP: 'Posted to SAP',
};

interface ExpenseStatusBadgeProps {
  status: string;
}

export default function ExpenseStatusBadge({ status }: ExpenseStatusBadgeProps) {
  const validStatus = (Object.keys(statusStyles).includes(status) ? status : 'Draft') as ExpenseStatus;

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

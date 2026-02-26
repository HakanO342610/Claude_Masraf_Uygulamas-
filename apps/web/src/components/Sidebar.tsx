'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  Receipt,
  CheckCircle,
  BarChart3,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Expenses', href: '/dashboard/expenses', icon: Receipt },
  { name: 'Approvals', href: '/dashboard/approvals', icon: CheckCircle },
  { name: 'Reports', href: '/dashboard/reports', icon: BarChart3 },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-16 items-center gap-2 border-b border-gray-200 px-6">
        <Receipt className="h-7 w-7 text-indigo-600" />
        <span className="text-lg font-bold text-gray-900">ExpenseHub</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              className={clsx(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
              )}
            >
              <item.icon
                className={clsx(
                  'h-5 w-5 flex-shrink-0',
                  isActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-600',
                )}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-200 p-4">
        <p className="text-xs text-gray-400 text-center">Expense Management v1.0</p>
      </div>
    </aside>
  );
}

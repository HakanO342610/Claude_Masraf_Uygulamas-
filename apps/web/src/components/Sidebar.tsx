'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  Receipt,
  CheckCircle,
  BarChart3,
  FileImage,
  Users,
  Server,
  LogOut,
  X,
  ScrollText,
} from 'lucide-react';
import { useAuthStore, useI18nStore } from '@/lib/store';
import { authApi } from '@/lib/api';

interface NavItem {
  name: string;
  href: string;
  icon: any;
  roles?: string[];
}

const navigation: (NavItem & { key: import('@/lib/i18n').TranslationKey })[] = [
  { name: 'Dashboard', key: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Expenses', key: 'expenses', href: '/dashboard/expenses', icon: Receipt },
  { name: 'Receipts', key: 'receipts', href: '/dashboard/receipts', icon: FileImage },
  { name: 'Approvals', key: 'approvals', href: '/dashboard/approvals', icon: CheckCircle, roles: ['MANAGER', 'FINANCE', 'ADMIN'] },
  { name: 'Reports', key: 'reports', href: '/dashboard/reports', icon: BarChart3, roles: ['MANAGER', 'FINANCE', 'ADMIN'] },
  { name: 'SAP Queue', key: 'sapQueue', href: '/dashboard/sap-queue', icon: Server, roles: ['FINANCE', 'ADMIN'] },
  { name: 'Users', key: 'users', href: '/dashboard/admin', icon: Users, roles: ['ADMIN', 'MANAGER'] },
  { name: 'Audit Logs', key: 'auditLogs', href: '/dashboard/admin/audit-logs', icon: ScrollText, roles: ['ADMIN'] },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { t } = useI18nStore();


  const userRole = user?.role || 'EMPLOYEE';

  const visibleNav = navigation.filter(
    (item) => !item.roles || item.roles.includes(userRole),
  );

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore errors — we're logging out anyway
    }
    logout();
    router.push('/login');
  };

  const handleNavClick = () => {
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-gray-200 bg-white transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 dark:border-gray-700 dark:bg-gray-800',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-gray-200 px-6 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Receipt className="h-7 w-7 text-indigo-600" />
            <span className="text-lg font-bold text-gray-900 dark:text-white">ExpenseHub</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 lg:hidden dark:hover:bg-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {visibleNav.map((item) => {
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={handleNavClick}
                className={clsx(
                  'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white',
                )}
              >
                <item.icon
                  className={clsx(
                    'h-5 w-5 flex-shrink-0',
                    isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300',
                  )}
                />
                {t[item.key]}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gray-200 p-4 space-y-3 dark:border-gray-700">
          {user && (
            <div className="px-3">
              <p className="text-sm font-medium text-gray-700 truncate dark:text-gray-300">{user.email}</p>
              <p className="text-xs text-gray-400">{userRole}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-red-50 hover:text-red-700 dark:text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
          >
            <LogOut className="h-5 w-5 text-gray-400" />
            {t.logout}
          </button>
        </div>
      </aside>
    </>
  );
}

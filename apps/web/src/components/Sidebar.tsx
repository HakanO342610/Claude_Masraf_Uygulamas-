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
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { authApi } from '@/lib/api';

interface NavItem {
  name: string;
  href: string;
  icon: any;
  roles?: string[];
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Expenses', href: '/dashboard/expenses', icon: Receipt },
  { name: 'Receipts', href: '/dashboard/receipts', icon: FileImage },
  { name: 'Approvals', href: '/dashboard/approvals', icon: CheckCircle, roles: ['MANAGER', 'FINANCE', 'ADMIN'] },
  { name: 'Reports', href: '/dashboard/reports', icon: BarChart3, roles: ['MANAGER', 'FINANCE', 'ADMIN'] },
  { name: 'SAP Queue', href: '/dashboard/sap-queue', icon: Server, roles: ['FINANCE', 'ADMIN'] },
  { name: 'Users', href: '/dashboard/admin', icon: Users, roles: ['ADMIN', 'MANAGER'] },
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
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-gray-200 bg-white transition-transform duration-200 ease-in-out lg:static lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-gray-200 px-6">
          <div className="flex items-center gap-2">
            <Receipt className="h-7 w-7 text-indigo-600" />
            <span className="text-lg font-bold text-gray-900">ExpenseHub</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 lg:hidden"
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

        <div className="border-t border-gray-200 p-4 space-y-3">
          {user && (
            <div className="px-3">
              <p className="text-sm font-medium text-gray-700 truncate">{user.email}</p>
              <p className="text-xs text-gray-400">{userRole}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="h-5 w-5 text-gray-400" />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}

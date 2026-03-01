'use client';

import { useEffect, useState } from 'react';
import {
  Users,
  Loader2,
  AlertTriangle,
  Shield,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import { usersApi } from '@/lib/api';
import { useI18nStore } from '@/lib/store';

interface User {
  id: string;
  name: string;
  email: string;
  department: string | null;
  role: string;
  createdAt: string;
}

const ROLES = ['EMPLOYEE', 'MANAGER', 'FINANCE', 'ADMIN'];
const DEPARTMENTS = [
  'IT',
  'HR',
  'Finance',
  'Engineering',
  'Sales',
  'Marketing',
  'Operations',
  'Legal',
  'Management',
];

const roleBadgeStyles: Record<string, string> = {
  ADMIN: 'bg-red-50 text-red-700',
  FINANCE: 'bg-emerald-50 text-emerald-700',
  MANAGER: 'bg-blue-50 text-blue-700',
  EMPLOYEE: 'bg-gray-100 text-gray-700',
};

export default function AdminPage() {
  const t = useI18nStore((state) => state.t);
  const locale = useI18nStore((state) => state.locale);

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editDept, setEditDept] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await usersApi.getAll();
      setUsers(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || t.failedLoadUsers);
    } finally {
      setIsLoading(false);
    }
  };

  const startEdit = (user: User) => {
    setEditingId(user.id);
    setEditRole(user.role);
    setEditDept(user.department || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (id: string) => {
    try {
      const user = users.find((u) => u.id === id);
      const promises = [];

      if (user?.role !== editRole) {
        promises.push(usersApi.updateRole(id, editRole));
      }

      if (user?.department !== editDept) {
        promises.push(usersApi.updateUser(id, { department: editDept }));
      }

      if (promises.length > 0) {
        await Promise.all(promises);
      }

      setEditingId(null);
      await fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.message || t.failedUpdateUser);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        <span className="ml-2 text-sm text-gray-500">{t.loadingUsers}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{t.userManagement}</h2>
        <p className="mt-1 text-sm text-gray-500">
          {t.manageUsersDesc}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {ROLES.map((role) => {
          const count = users.filter((u) => u.role === role).length;
          return (
            <div
              key={role}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">{t[`role_${role}` as keyof typeof t] || role}</span>
                <Users className="h-4 w-4 text-gray-400" />
              </div>
              <p className="mt-1 text-2xl font-bold text-gray-900">{count}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-6 py-3 text-left font-medium text-gray-500">{t.name}</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">{t.email}</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">{t.department}</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">{t.role}</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500">{t.joined}</th>
              <th className="px-6 py-3 text-right font-medium text-gray-500">{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900">{user.name}</td>
                <td className="px-6 py-4 text-gray-500">{user.email}</td>
                <td className="px-6 py-4">
                  {editingId === user.id ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={editDept}
                        onChange={(e) => setEditDept(e.target.value)}
                        className="w-28 rounded border border-gray-300 px-2 py-1 text-xs"
                      >
                        <option value="">- Seçiniz -</option>
                        {DEPARTMENTS.map((dept) => {
                          const translationKey = `dept_${dept.replace(/[&\s]/g, '_')}`;
                          return (
                            <option key={dept} value={dept}>
                              {t[translationKey as keyof typeof t] || dept}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  ) : (
                    <span className="text-gray-600">
                      {user.department 
                        ? (t[`dept_${user.department.replace(/[&\s]/g, '_')}` as keyof typeof t] || user.department)
                        : '-'}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  {editingId === user.id ? (
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      className="rounded border border-gray-300 px-2 py-1 text-xs"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{t[`role_${r}` as keyof typeof t] || r}</option>
                      ))}
                    </select>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${roleBadgeStyles[user.role] || 'bg-gray-100 text-gray-700'}`}
                    >
                      <Shield className="h-3 w-3" />
                      {t[`role_${user.role}` as keyof typeof t] || user.role}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-gray-500">
                  {new Date(user.createdAt).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US')}
                </td>
                <td className="px-6 py-4 text-right">
                  {editingId === user.id ? (
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => saveEdit(user.id)}
                        className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(user)}
                      className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

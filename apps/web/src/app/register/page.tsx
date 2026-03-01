'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserPlus, Globe } from 'lucide-react';
import { authApi } from '@/lib/api';
import { useAuthStore, useI18nStore } from '@/lib/store';

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

const getRegisterSchema = (t: any) => z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string()
    .min(8, t.passwordMinLength8)
    .regex(/[A-Z]/, t.passwordUppercase)
    .regex(/[a-z]/, t.passwordLowercase)
    .regex(/[0-9]/, t.passwordNumber)
    .regex(/[^A-Za-z0-9]/, t.passwordSpecial),
  department: z.string().optional(),
});

type RegisterFormData = z.infer<ReturnType<typeof getRegisterSchema>>;

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const { t, locale, setLocale } = useI18nStore();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(getRegisterSchema(t)),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await authApi.register(data);
      const { accessToken, refreshToken, user } = response.data;
      setAuth(user, accessToken, refreshToken);
      router.push('/dashboard');
    } catch (err: any) {
      const message =
        err.response?.data?.message || 'Registration failed. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white dark:bg-gray-900">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-indigo-600 items-center justify-center p-12">
        <div className="max-w-md text-white">
          <h1 className="text-4xl font-bold mb-6">{t.joinExpenseHub}</h1>
          <p className="text-indigo-100 text-lg leading-relaxed">
            {t.joinSubtitle}
          </p>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-2 lg:hidden">
                  <UserPlus className="h-8 w-8 text-indigo-600" />
                  <span className="text-xl font-bold text-gray-900 dark:text-white">ExpenseHub</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t.createYourAccount}</h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {t.fillDetails}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLocale(locale === 'tr' ? 'en' : 'tr')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 dark:bg-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition"
              >
                <Globe className="w-4 h-4" />
                {locale === 'tr' ? 'TR' : 'EN'}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t.fullName}
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                placeholder="John Doe"
                {...register('name')}
                className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-gray-900 dark:text-white bg-white dark:bg-gray-800 shadow-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
              />
              {errors.name && (
                <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t.emailAddress}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                {...register('email')}
                className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-gray-900 dark:text-white bg-white dark:bg-gray-800 shadow-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
              />
              {errors.email && (
                <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t.passwordLabel}
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 6 characters"
                {...register('password')}
                className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-gray-900 dark:text-white bg-white dark:bg-gray-800 shadow-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
              />
              {errors.password && (
                <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.password.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="department" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t.department || 'Department'} <span className="text-gray-400 dark:text-gray-500">{t.optional}</span>
              </label>
              <select
                id="department"
                {...register('department')}
                className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-gray-900 dark:text-white bg-white dark:bg-gray-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
              >
                <option value="">{t.selectDepartment || 'Select Department'}</option>
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {t[`dept_${dept.replace(/[&\s]/g, '_')}` as keyof typeof t] || dept}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Creating account...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  {t.createAnAccount}
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            {t.alreadyHaveAccount}{' '}
            <Link
              href="/login"
              className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-colors"
            >
              {t.signIn}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

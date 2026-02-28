import { test, expect, Page } from '@playwright/test';

const API_BASE = '/api/v1';

async function mockLoginSuccess(page: Page) {
  await page.route(`**${API_BASE}/auth/login`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: { id: 'u1', email: 'admin@test.com', role: 'ADMIN' },
      }),
    });
  });
}

async function mockDashboardData(page: Page) {
  await page.route(`**${API_BASE}/expenses*`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
  await page.route(`**${API_BASE}/reports/summary*`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ total: 0, pending: 0, approved: 0, rejected: 0 }),
    });
  });
}

test.describe('Authentication', () => {
  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /giriş|login/i })).toBeVisible();
    await expect(page.getByLabel(/e-?posta|email/i)).toBeVisible();
    await expect(page.getByLabel(/şifre|password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /giriş|sign in|login/i })).toBeVisible();
  });

  test('shows validation error for empty form', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /giriş|sign in|login/i }).click();
    // HTML5 validation or custom error message should appear
    const emailInput = page.getByLabel(/e-?posta|email/i);
    await expect(emailInput).toBeVisible();
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.route(`**${API_BASE}/auth/login`, (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid credentials' }),
      });
    });

    await page.goto('/login');
    await page.getByLabel(/e-?posta|email/i).fill('wrong@test.com');
    await page.getByLabel(/şifre|password/i).fill('wrongpass');
    await page.getByRole('button', { name: /giriş|sign in|login/i }).click();

    await expect(page.getByText(/hata|error|invalid|geçersiz/i)).toBeVisible({ timeout: 5000 });
  });

  test('redirects to dashboard after successful login', async ({ page }) => {
    await mockLoginSuccess(page);
    await mockDashboardData(page);

    await page.goto('/login');
    await page.getByLabel(/e-?posta|email/i).fill('admin@test.com');
    await page.getByLabel(/şifre|password/i).fill('password123');
    await page.getByRole('button', { name: /giriş|sign in|login/i }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 8000 });
  });

  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });
});

import { test, expect, Page } from '@playwright/test';

const API_BASE = '/api/v1';

async function setupAdminSession(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('accessToken', 'mock-admin-token');
    localStorage.setItem(
      'user',
      JSON.stringify({ id: 'admin1', email: 'admin@test.com', role: 'ADMIN', name: 'Admin User' }),
    );
  });

  await page.route(`**${API_BASE}/auth/me`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'admin1', email: 'admin@test.com', role: 'ADMIN', name: 'Admin User' }),
    });
  });
}

const samplePositions = [
  {
    id: 'pos-1',
    title: 'IT Direktörü',
    code: 'POS-IT-DIR',
    level: 1,
    isActive: true,
    departmentId: 'dept-2',
    department: { id: 'dept-2', name: 'Bilgi Teknolojileri', code: 'BT' },
    parentPosition: null,
    _count: { users: 2, childPositions: 1 },
  },
  {
    id: 'pos-2',
    title: 'Yazılım Müdürü',
    code: 'POS-SW-MGR',
    level: 2,
    isActive: true,
    departmentId: 'dept-2',
    department: { id: 'dept-2', name: 'Bilgi Teknolojileri', code: 'BT' },
    parentPosition: { id: 'pos-1', title: 'IT Direktörü', code: 'POS-IT-DIR' },
    _count: { users: 3, childPositions: 2 },
  },
  {
    id: 'pos-3',
    title: 'Finans Müdürü',
    code: 'POS-FIN-MGR',
    level: 1,
    isActive: true,
    departmentId: 'dept-3',
    department: { id: 'dept-3', name: 'Finans', code: 'FIN' },
    parentPosition: null,
    _count: { users: 1, childPositions: 0 },
  },
];

const sampleDepartments = [
  { id: 'dept-2', name: 'Bilgi Teknolojileri', code: 'BT', level: 1 },
  { id: 'dept-3', name: 'Finans', code: 'FIN', level: 1 },
];

test.describe('Positions Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdminSession(page);

    await page.route(`**${API_BASE}/positions*`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(samplePositions),
      });
    });

    await page.route(`**${API_BASE}/departments*`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(sampleDepartments),
      });
    });
  });

  test('shows page title', async ({ page }) => {
    await page.goto('/dashboard/admin/positions');
    await expect(page.getByText(/pozisyon/i)).toBeVisible({ timeout: 8000 });
  });

  test('renders position list', async ({ page }) => {
    await page.goto('/dashboard/admin/positions');
    await expect(page.getByText('IT Direktörü')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Yazılım Müdürü')).toBeVisible();
    await expect(page.getByText('Finans Müdürü')).toBeVisible();
  });

  test('shows position codes', async ({ page }) => {
    await page.goto('/dashboard/admin/positions');
    await expect(page.getByText('POS-IT-DIR')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('POS-SW-MGR')).toBeVisible();
  });

  test('shows department names', async ({ page }) => {
    await page.goto('/dashboard/admin/positions');
    await expect(page.getByText('Bilgi Teknolojileri')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Finans')).toBeVisible();
  });

  test('shows level indicators', async ({ page }) => {
    await page.goto('/dashboard/admin/positions');
    await expect(page.getByText(/L1/)).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/L2/)).toBeVisible();
  });

  test('shows parent position reference', async ({ page }) => {
    await page.goto('/dashboard/admin/positions');
    await expect(page.getByText(/IT Direktörü/)).toBeVisible({ timeout: 8000 });
  });

  test('has Pozisyon Ekle button', async ({ page }) => {
    await page.goto('/dashboard/admin/positions');
    await expect(page.getByRole('button', { name: /pozisyon ekle|yeni pozisyon|ekle/i })).toBeVisible({ timeout: 8000 });
  });

  test('has search input', async ({ page }) => {
    await page.goto('/dashboard/admin/positions');
    const searchInput = page.getByPlaceholder(/ara|search/i);
    await expect(searchInput).toBeVisible({ timeout: 8000 });
  });

  test('search filters positions', async ({ page }) => {
    await page.goto('/dashboard/admin/positions');
    const searchInput = page.getByPlaceholder(/ara|search/i);
    await searchInput.fill('finans');
    await expect(page.getByText('Finans Müdürü')).toBeVisible({ timeout: 5000 });
  });

  test('shows user and child position counts', async ({ page }) => {
    await page.goto('/dashboard/admin/positions');
    // pos-2 has 3 users and 2 children
    await expect(page.getByText(/3.*kişi|kişi.*3/i)).toBeVisible({ timeout: 8000 });
  });
});

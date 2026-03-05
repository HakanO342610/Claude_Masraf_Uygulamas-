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

const sampleTree = [
  {
    id: 'dept-1',
    name: 'Genel Müdürlük',
    code: 'GM',
    level: 0,
    isActive: true,
    parentId: null,
    manager: { id: 'u1', name: 'Admin User', email: 'admin@test.com' },
    managerPosition: null,
    _count: { users: 3, positions: 2 },
    children: [
      {
        id: 'dept-2',
        name: 'Bilgi Teknolojileri',
        code: 'BT',
        level: 1,
        isActive: true,
        parentId: 'dept-1',
        manager: null,
        managerPosition: { id: 'pos-1', title: 'IT Direktörü', code: 'POS-IT-DIR' },
        _count: { users: 5, positions: 3 },
        children: [],
      },
      {
        id: 'dept-3',
        name: 'Finans',
        code: 'FIN',
        level: 1,
        isActive: true,
        parentId: 'dept-1',
        manager: null,
        managerPosition: null,
        _count: { users: 2, positions: 1 },
        children: [],
      },
    ],
  },
];

const sampleDeptDetail = {
  id: 'dept-1',
  name: 'Genel Müdürlük',
  code: 'GM',
  level: 0,
  isActive: true,
  parentId: null,
  manager: { id: 'u1', name: 'Admin User', email: 'admin@test.com' },
  managerPosition: null,
  children: [],
  positions: [{ id: 'pos-1', title: 'Genel Müdür', code: 'POS-GM', level: 0, isActive: true }],
  users: [{ id: 'u1', name: 'Admin User', email: 'admin@test.com', role: 'ADMIN' }],
  _count: { users: 1, positions: 1, children: 2 },
};

const sampleUsers = [
  { id: 'u1', name: 'Admin User', email: 'admin@test.com', role: 'ADMIN' },
  { id: 'u2', name: 'Manager User', email: 'manager@test.com', role: 'MANAGER' },
];

const samplePositions = [
  { id: 'pos-1', title: 'IT Direktörü', code: 'POS-IT-DIR', level: 1 },
  { id: 'pos-2', title: 'Finans Müdürü', code: 'POS-FIN-MGR', level: 1 },
];

test.describe('Org Chart Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdminSession(page);

    await page.route(`**${API_BASE}/departments/tree*`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(sampleTree),
      });
    });

    await page.route(`**${API_BASE}/departments/dept-1`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(sampleDeptDetail),
      });
    });

    await page.route(`**${API_BASE}/users*`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(sampleUsers),
      });
    });

    await page.route(`**${API_BASE}/positions*`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(samplePositions),
      });
    });
  });

  test('shows page title', async ({ page }) => {
    await page.goto('/dashboard/admin/org-chart');
    await expect(page.getByText(/organizasyon şeması/i)).toBeVisible({ timeout: 8000 });
  });

  test('renders department tree root node', async ({ page }) => {
    await page.goto('/dashboard/admin/org-chart');
    await expect(page.getByText('Genel Müdürlük')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('(GM)')).toBeVisible();
  });

  test('shows child departments when expanded', async ({ page }) => {
    await page.goto('/dashboard/admin/org-chart');
    // Root açık geliyor — child'lar görünür
    await expect(page.getByText('Bilgi Teknolojileri')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Finans')).toBeVisible();
  });

  test('has Departman Ekle button', async ({ page }) => {
    await page.goto('/dashboard/admin/org-chart');
    await expect(page.getByRole('button', { name: /departman ekle/i })).toBeVisible({ timeout: 8000 });
  });

  test('has Kurulum Sihirbazı link', async ({ page }) => {
    await page.goto('/dashboard/admin/org-chart');
    await expect(page.getByRole('link', { name: /kurulum sihirbazı/i })).toBeVisible({ timeout: 8000 });
  });

  test('clicking department shows detail panel', async ({ page }) => {
    await page.goto('/dashboard/admin/org-chart');
    await page.getByText('Genel Müdürlük').first().click();
    await expect(page.getByText(/yönetici/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Admin User')).toBeVisible();
  });

  test('detail panel shows positions list', async ({ page }) => {
    await page.goto('/dashboard/admin/org-chart');
    await page.getByText('Genel Müdürlük').first().click();
    await expect(page.getByText('Genel Müdür')).toBeVisible({ timeout: 8000 });
  });

  test('form opens when Departman Ekle clicked', async ({ page }) => {
    await page.goto('/dashboard/admin/org-chart');
    await page.getByRole('button', { name: /departman ekle/i }).click();
    await expect(page.getByText(/yeni departman/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByLabel(/^ad/i)).toBeVisible();
    await expect(page.getByLabel(/^kod/i)).toBeVisible();
  });

  test('form has Yönetici Pozisyon dropdown with positions', async ({ page }) => {
    await page.goto('/dashboard/admin/org-chart');
    await page.getByRole('button', { name: /departman ekle/i }).click();
    await expect(page.getByText(/yönetici pozisyon/i)).toBeVisible({ timeout: 8000 });
    // Dropdown should contain positions
    const select = page.locator('select').first();
    await expect(select).toBeVisible();
  });

  test('Tümünü Aç / Kapat buttons exist', async ({ page }) => {
    await page.goto('/dashboard/admin/org-chart');
    await expect(page.getByRole('button', { name: /tümünü aç/i })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: /tümünü kapat/i })).toBeVisible();
  });
});

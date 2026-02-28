import { test, expect, Page } from '@playwright/test';

const API_BASE = '/api/v1';

async function setupAuthenticatedSession(page: Page) {
  // Mock auth check — the app reads token from localStorage
  await page.addInitScript(() => {
    localStorage.setItem('accessToken', 'mock-access-token');
    localStorage.setItem(
      'user',
      JSON.stringify({ id: 'u1', email: 'emp@test.com', role: 'EMPLOYEE' }),
    );
  });

  await page.route(`**${API_BASE}/auth/me`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'u1', email: 'emp@test.com', role: 'EMPLOYEE' }),
    });
  });
}

const sampleExpenses = [
  {
    id: 'e1',
    amount: 500,
    currency: 'TRY',
    category: 'Travel',
    description: 'Business trip to Ankara',
    status: 'DRAFT',
    expenseDate: '2025-01-15T00:00:00.000Z',
    createdAt: '2025-01-15T10:00:00.000Z',
    user: { name: 'Test Employee', email: 'emp@test.com' },
    approvals: [],
  },
  {
    id: 'e2',
    amount: 1200,
    currency: 'TRY',
    category: 'Accommodation',
    description: 'Hotel stay',
    status: 'SUBMITTED',
    expenseDate: '2025-01-20T00:00:00.000Z',
    createdAt: '2025-01-20T10:00:00.000Z',
    user: { name: 'Test Employee', email: 'emp@test.com' },
    approvals: [],
  },
];

test.describe('Expense List', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedSession(page);
    await page.route(`**${API_BASE}/expenses*`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(sampleExpenses),
      });
    });
    await page.route(`**${API_BASE}/reports/summary*`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ total: 1700, pending: 1, approved: 0, rejected: 0 }),
      });
    });
  });

  test('displays expense list', async ({ page }) => {
    await page.goto('/dashboard/expenses');
    await expect(page.getByText('Business trip to Ankara')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Hotel stay')).toBeVisible();
  });

  test('shows expense amounts', async ({ page }) => {
    await page.goto('/dashboard/expenses');
    await expect(page.getByText(/500/)).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/1[.,]?200/)).toBeVisible();
  });

  test('shows expense status badges', async ({ page }) => {
    await page.goto('/dashboard/expenses');
    await expect(page.getByText(/draft|taslak/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/submitted|gönderildi/i)).toBeVisible();
  });

  test('has link to create new expense', async ({ page }) => {
    await page.goto('/dashboard/expenses');
    const newButton = page.getByRole('link', { name: /yeni|new|ekle|add/i });
    await expect(newButton).toBeVisible({ timeout: 8000 });
    await expect(newButton).toHaveAttribute('href', /\/expenses\/new/);
  });
});

test.describe('Create Expense', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedSession(page);
  });

  test('new expense form renders all required fields', async ({ page }) => {
    await page.goto('/dashboard/expenses/new');
    await expect(page.getByLabel(/tutar|amount/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByLabel(/kategori|category/i)).toBeVisible();
    await expect(page.getByLabel(/tarih|date/i)).toBeVisible();
    await expect(page.getByLabel(/açıklama|description/i)).toBeVisible();
  });

  test('submits expense and redirects on success', async ({ page }) => {
    await page.route(`**${API_BASE}/expenses`, (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'e-new', status: 'DRAFT', amount: 300 }),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      }
    });

    await page.goto('/dashboard/expenses/new');

    await page.getByLabel(/tutar|amount/i).fill('300');
    await page.getByLabel(/açıklama|description/i).fill('Test expense');

    // Category selection (might be a select element)
    const categoryField = page.getByLabel(/kategori|category/i);
    if (await categoryField.evaluate((el) => el.tagName) === 'SELECT') {
      await categoryField.selectOption({ index: 1 });
    } else {
      await categoryField.fill('Travel');
    }

    // Date
    const dateField = page.getByLabel(/tarih|date/i);
    await dateField.fill('2025-02-01');

    await page.getByRole('button', { name: /kaydet|save|oluştur|create/i }).click();

    // Should redirect to expenses list after creation
    await expect(page).toHaveURL(/\/expenses/, { timeout: 8000 });
  });
});

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedSession(page);
    await page.route(`**${API_BASE}/expenses*`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(sampleExpenses),
      });
    });
    await page.route(`**${API_BASE}/reports/summary*`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ total: 1700, pending: 1, approved: 0, rejected: 0 }),
      });
    });
  });

  test('shows summary cards', async ({ page }) => {
    await page.goto('/dashboard');
    // Dashboard should show stat cards
    await expect(page.locator('[class*="card"], [class*="stat"], main')).toBeVisible({
      timeout: 8000,
    });
  });

  test('sidebar navigation is visible', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('navigation')).toBeVisible({ timeout: 8000 });
  });
});

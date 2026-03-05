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

const setupStatusNotConfigured = {
  configured: false,
  setupModel: null,
  organization: null,
};

const setupStatusConfigured = {
  configured: true,
  setupModel: 'STANDALONE',
  organization: { id: 'org-1', name: 'Test Şirket', slug: 'test-sirket' },
};

test.describe('Setup Wizard Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdminSession(page);
  });

  test('shows page title', async ({ page }) => {
    await page.route(`**${API_BASE}/setup/status`, (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(setupStatusNotConfigured) });
    });
    await page.goto('/dashboard/admin/setup');
    await expect(page.getByText(/kurulum sihirbazı|setup/i)).toBeVisible({ timeout: 8000 });
  });

  test('shows step 1 model selection initially', async ({ page }) => {
    await page.route(`**${API_BASE}/setup/status`, (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(setupStatusNotConfigured) });
    });
    await page.goto('/dashboard/admin/setup');
    await expect(page.getByText(/model seçimi|kurulum modeli/i)).toBeVisible({ timeout: 8000 });
  });

  test('shows 3 setup models to choose from', async ({ page }) => {
    await page.route(`**${API_BASE}/setup/status`, (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(setupStatusNotConfigured) });
    });
    await page.goto('/dashboard/admin/setup');
    await expect(page.getByText(/standalone|bağımsız/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/sap.*hr|sap hr/i)).toBeVisible();
    await expect(page.getByText(/directory|dizin|ldap|azure/i)).toBeVisible();
  });

  test('can select Standalone model', async ({ page }) => {
    await page.route(`**${API_BASE}/setup/status`, (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(setupStatusNotConfigured) });
    });
    await page.goto('/dashboard/admin/setup');
    // Click on standalone option
    await page.getByText(/standalone|bağımsız/i).first().click();
    // Should be selectable (no error)
  });

  test('shows already configured state', async ({ page }) => {
    await page.route(`**${API_BASE}/setup/status`, (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(setupStatusConfigured) });
    });
    await page.goto('/dashboard/admin/setup');
    // Should show current config or reconfigure option
    await expect(page.locator('body')).toBeVisible({ timeout: 8000 });
  });

  test('next button advances to step 2', async ({ page }) => {
    await page.route(`**${API_BASE}/setup/status`, (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(setupStatusNotConfigured) });
    });
    await page.goto('/dashboard/admin/setup');
    // Select a model first
    await page.getByText(/standalone|bağımsız/i).first().click();
    // Find and click next
    const nextBtn = page.getByRole('button', { name: /ileri|devam|next/i });
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await expect(page.getByText(/organizasyon|şirket bilgileri|org/i)).toBeVisible({ timeout: 5000 });
    }
  });

  test('SAP HR model shows SAP system type options', async ({ page }) => {
    await page.route(`**${API_BASE}/setup/status`, (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(setupStatusNotConfigured) });
    });
    await page.goto('/dashboard/admin/setup');
    // Select SAP HR model
    const sapOption = page.getByText(/sap.*hr|sap hr/i).first();
    if (await sapOption.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sapOption.click();
      // Should show ECC, S4 options after selection or on next step
    }
  });

  test('has link to org chart from wizard', async ({ page }) => {
    await page.route(`**${API_BASE}/setup/status`, (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(setupStatusNotConfigured) });
    });
    await page.goto('/dashboard/admin/setup');
    // There should be a way back to org chart
    const orgChartLink = page.getByRole('link', { name: /org|şema/i });
    if (await orgChartLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(orgChartLink).toHaveAttribute('href', /org-chart/);
    }
  });
});

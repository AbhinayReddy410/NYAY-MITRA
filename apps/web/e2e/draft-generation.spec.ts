import { test, expect } from '@playwright/test';

/**
 * Draft Generation Flow E2E Tests
 *
 * Tests the complete user journey from category selection to draft download:
 * 1. Browse categories
 * 2. Select template
 * 3. Fill dynamic form
 * 4. Generate draft
 * 5. Download document
 *
 * Also tests error scenarios like validation errors and limit exceeded.
 */

// Helper to setup authenticated session
async function setupAuth(context: any): Promise<void> {
  await context.addCookies([{
    name: '__session',
    value: 'test-session-token',
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    secure: false,
    sameSite: 'Lax',
  }]);
}

test.describe('Draft Generation - Happy Path', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuth(context);
    await page.goto('/dashboard');
  });

  test('complete draft generation journey', async ({ page }) => {
    // Step 1: Dashboard shows categories
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    await expect(page.getByText(/select a category/i)).toBeVisible();

    // Step 2: Click on Civil category
    const civilCategory = page.getByRole('link', { name: /civil/i }).first();
    await civilCategory.click();

    // Step 3: Category page shows templates
    await expect(page).toHaveURL(/category\/civil/);
    await expect(page.getByRole('heading', { name: /civil/i })).toBeVisible();
    await expect(page.getByText(/rent agreement/i)).toBeVisible();

    // Step 4: Click on Rent Agreement template
    await page.getByRole('link', { name: /rent agreement/i }).click();

    // Step 5: Template page shows form
    await expect(page).toHaveURL(/template\//);
    await expect(page.getByRole('heading', { name: /rent agreement/i })).toBeVisible();

    // Step 6: Fill all required fields
    await page.getByLabel(/landlord name/i).fill('Rajesh Kumar');
    await page.getByLabel(/tenant name/i).fill('Priya Sharma');
    await page.getByLabel(/monthly rent/i).fill('25000');
    await page.getByLabel(/start date/i).fill('2026-02-01');

    // Optional: Fill address if present
    const addressField = page.getByLabel(/address/i);
    if (await addressField.isVisible()) {
      await addressField.fill('123 MG Road, Bangalore 560001');
    }

    // Step 7: Submit form to generate draft
    const generateButton = page.getByRole('button', { name: /generate/i });
    await expect(generateButton).toBeEnabled();
    await generateButton.click();

    // Step 8: Loading state
    await expect(page.getByText(/generating/i)).toBeVisible();

    // Step 9: Success page with download button
    await expect(page.getByText(/draft generated/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /download/i })).toBeVisible();

    // Step 10: Verify download URL is present
    const downloadButton = page.getByRole('button', { name: /download/i });
    const downloadUrl = await downloadButton.getAttribute('href');
    expect(downloadUrl).toBeTruthy();
    expect(downloadUrl).toContain('.docx');

    // Step 11: Verify can go back to templates
    await expect(page.getByRole('link', { name: /back to templates/i })).toBeVisible();
  });

  test('shows draft preview before download', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /civil/i }).first().click();
    await page.getByRole('link', { name: /rent agreement/i }).click();

    // Fill form
    await page.getByLabel(/landlord name/i).fill('Amit Patel');
    await page.getByLabel(/tenant name/i).fill('Neha Gupta');
    await page.getByLabel(/monthly rent/i).fill('30000');
    await page.getByLabel(/start date/i).fill('2026-03-01');

    await page.getByRole('button', { name: /generate/i }).click();

    // Wait for success
    await expect(page.getByText(/draft generated/i)).toBeVisible();

    // Should show document details
    await expect(page.getByText(/rent agreement/i)).toBeVisible();
    await expect(page.getByText(/amit patel/i)).toBeVisible();
    await expect(page.getByText(/neha gupta/i)).toBeVisible();
    await expect(page.getByText(/₹30,000/i)).toBeVisible();
  });

  test('adds draft to history', async ({ page }) => {
    // Generate a draft
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /civil/i }).first().click();
    await page.getByRole('link', { name: /rent agreement/i }).click();

    await page.getByLabel(/landlord name/i).fill('Test Landlord');
    await page.getByLabel(/tenant name/i).fill('Test Tenant');
    await page.getByLabel(/monthly rent/i).fill('20000');
    await page.getByLabel(/start date/i).fill('2026-02-01');

    await page.getByRole('button', { name: /generate/i }).click();
    await expect(page.getByText(/draft generated/i)).toBeVisible();

    // Go to history
    await page.getByRole('link', { name: /history/i }).click();

    // Should see the draft in history
    await expect(page).toHaveURL(/history/);
    await expect(page.getByText(/rent agreement/i)).toBeVisible();
    await expect(page.getByText(/test landlord/i)).toBeVisible();
  });
});

test.describe('Draft Generation - Form Validation', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuth(context);
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /civil/i }).first().click();
    await page.getByRole('link', { name: /rent agreement/i }).click();
  });

  test('shows validation errors for required fields', async ({ page }) => {
    // Try to generate without filling any fields
    const generateButton = page.getByRole('button', { name: /generate/i });
    await generateButton.click();

    // Should show error messages for all required fields
    await expect(page.getByText(/landlord name.*required/i)).toBeVisible();
    await expect(page.getByText(/tenant name.*required/i)).toBeVisible();
    await expect(page.getByText(/rent.*required/i)).toBeVisible();
    await expect(page.getByText(/date.*required/i)).toBeVisible();

    // Generate button should still be visible (not submitted)
    await expect(generateButton).toBeVisible();
  });

  test('validates currency field accepts only numbers', async ({ page }) => {
    await page.getByLabel(/monthly rent/i).fill('invalid-amount');
    await page.getByLabel(/landlord name/i).click(); // Trigger blur

    await expect(page.getByText(/valid.*number/i)).toBeVisible();
  });

  test('validates date field format', async ({ page }) => {
    await page.getByLabel(/start date/i).fill('invalid-date');
    await page.getByLabel(/landlord name/i).click(); // Trigger blur

    await expect(page.getByText(/valid.*date/i)).toBeVisible();
  });

  test('clears validation errors when fields filled correctly', async ({ page }) => {
    // Trigger validation errors
    await page.getByRole('button', { name: /generate/i }).click();
    await expect(page.getByText(/landlord name.*required/i)).toBeVisible();

    // Fill field correctly
    await page.getByLabel(/landlord name/i).fill('Valid Name');

    // Error should disappear
    await expect(page.getByText(/landlord name.*required/i)).not.toBeVisible();
  });

  test('validates phone number format if present', async ({ page }) => {
    const phoneField = page.getByLabel(/phone/i);

    if (await phoneField.isVisible()) {
      await phoneField.fill('12345');
      await page.getByLabel(/landlord name/i).click(); // Trigger blur

      await expect(page.getByText(/valid.*phone/i)).toBeVisible();

      // Valid phone
      await phoneField.fill('9876543210');
      await page.getByLabel(/landlord name/i).click();

      await expect(page.getByText(/valid.*phone/i)).not.toBeVisible();
    }
  });

  test('validates email format if present', async ({ page }) => {
    const emailField = page.getByLabel(/email/i);

    if (await emailField.isVisible()) {
      await emailField.fill('invalid-email');
      await page.getByLabel(/landlord name/i).click(); // Trigger blur

      await expect(page.getByText(/valid.*email/i)).toBeVisible();

      // Valid email
      await emailField.fill('test@example.com');
      await page.getByLabel(/landlord name/i).click();

      await expect(page.getByText(/valid.*email/i)).not.toBeVisible();
    }
  });
});

test.describe('Draft Generation - Error Scenarios', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuth(context);
  });

  test('handles draft limit exceeded', async ({ page }) => {
    // Mock API to return 402 Payment Required
    await page.route('**/api/drafts', async route => {
      await route.fulfill({
        status: 402,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'DRAFT_LIMIT_EXCEEDED',
            message: 'You have reached your monthly draft limit',
            details: {
              used: 10,
              limit: 10,
              plan: 'free',
            },
          },
        }),
      });
    });

    await page.goto('/dashboard');
    await page.getByRole('link', { name: /civil/i }).first().click();
    await page.getByRole('link', { name: /rent agreement/i }).click();

    // Fill form
    await page.getByLabel(/landlord name/i).fill('Test User');
    await page.getByLabel(/tenant name/i).fill('Test Tenant');
    await page.getByLabel(/monthly rent/i).fill('25000');
    await page.getByLabel(/start date/i).fill('2026-02-01');

    await page.getByRole('button', { name: /generate/i }).click();

    // Should show limit exceeded modal
    await expect(page.getByText(/limit.*exceeded/i)).toBeVisible();
    await expect(page.getByText(/10.*10/i)).toBeVisible(); // Shows usage
    await expect(page.getByRole('button', { name: /upgrade/i })).toBeVisible();

    // Can click upgrade button
    const upgradeButton = page.getByRole('button', { name: /upgrade/i });
    await upgradeButton.click();

    // Should navigate to pricing or payment page
    await expect(page).toHaveURL(/pricing|payment|upgrade/);
  });

  test('handles template not found', async ({ page }) => {
    await page.goto('/template/non-existent-id');

    await expect(page.getByText(/template.*not found/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /back to dashboard/i })).toBeVisible();
  });

  test('handles API server error gracefully', async ({ page }) => {
    // Mock 500 error
    await page.route('**/api/drafts', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
          },
        }),
      });
    });

    await page.goto('/dashboard');
    await page.getByRole('link', { name: /civil/i }).first().click();
    await page.getByRole('link', { name: /rent agreement/i }).click();

    // Fill and submit
    await page.getByLabel(/landlord name/i).fill('Test');
    await page.getByLabel(/tenant name/i).fill('Test');
    await page.getByLabel(/monthly rent/i).fill('25000');
    await page.getByLabel(/start date/i).fill('2026-02-01');
    await page.getByRole('button', { name: /generate/i }).click();

    // Should show error message
    await expect(page.getByText(/something went wrong/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /try again/i })).toBeVisible();

    // Can retry
    await page.getByRole('button', { name: /try again/i }).click();
    await expect(page.getByRole('button', { name: /generate/i })).toBeVisible();
  });

  test('handles network error', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /civil/i }).first().click();
    await page.getByRole('link', { name: /rent agreement/i }).click();

    // Simulate offline
    await page.context().setOffline(true);

    // Fill and submit
    await page.getByLabel(/landlord name/i).fill('Test');
    await page.getByLabel(/tenant name/i).fill('Test');
    await page.getByLabel(/monthly rent/i).fill('25000');
    await page.getByLabel(/start date/i).fill('2026-02-01');
    await page.getByRole('button', { name: /generate/i }).click();

    // Should show network error
    await expect(page.getByText(/network.*error|connection.*failed/i)).toBeVisible();

    // Go back online
    await page.context().setOffline(false);

    // Can retry
    const retryButton = page.getByRole('button', { name: /try again|retry/i });
    if (await retryButton.isVisible()) {
      await retryButton.click();
    }
  });
});

test.describe('Draft Generation - Currency Formatting', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuth(context);
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /civil/i }).first().click();
    await page.getByRole('link', { name: /rent agreement/i }).click();
  });

  test('formats Indian currency correctly in preview', async ({ page }) => {
    await page.getByLabel(/landlord name/i).fill('Test');
    await page.getByLabel(/tenant name/i).fill('Test');
    await page.getByLabel(/monthly rent/i).fill('100000');
    await page.getByLabel(/start date/i).fill('2026-02-01');

    await page.getByRole('button', { name: /generate/i }).click();
    await expect(page.getByText(/draft generated/i)).toBeVisible();

    // Should show ₹1,00,000 (Indian number format)
    await expect(page.getByText(/₹1,00,000/)).toBeVisible();
  });

  test('formats date in DD/MM/YYYY format', async ({ page }) => {
    await page.getByLabel(/landlord name/i).fill('Test');
    await page.getByLabel(/tenant name/i).fill('Test');
    await page.getByLabel(/monthly rent/i).fill('25000');
    await page.getByLabel(/start date/i).fill('2026-02-15');

    await page.getByRole('button', { name: /generate/i }).click();
    await expect(page.getByText(/draft generated/i)).toBeVisible();

    // Should show 15/02/2026
    await expect(page.getByText(/15\/02\/2026/)).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';

/**
 * Draft Generation Flow E2E Tests
 *
 * Tests the complete user journey from category selection to draft download
 */

test.describe('Draft Generation Flow', () => {
  test.beforeEach(async ({ page, context }) => {
    // Set auth cookie to bypass middleware protection
    await context.addCookies([
      {
        name: 'nyayamitra_auth',
        value: 'mock-auth-token',
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ]);

    // Mock Firebase initialization and auth state
    await context.addInitScript(() => {
      // Set mock environment variables
      (window as any).process = (window as any).process || {};
      (window as any).process.env = (window as any).process.env || {};
      Object.assign((window as any).process.env, {
        NEXT_PUBLIC_FIREBASE_API_KEY: 'mock-api-key',
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'mock-domain.firebaseapp.com',
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'mock-project',
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'mock-bucket.appspot.com',
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '123456789',
        NEXT_PUBLIC_FIREBASE_APP_ID: '1:123456789:web:abc123',
      });

      // Mock Firebase user
      const mockUser = {
        uid: 'test-user',
        email: 'test@example.com',
        displayName: 'Test User',
        emailVerified: true,
        isAnonymous: false,
        metadata: {},
        providerData: [],
        refreshToken: 'mock-refresh-token',
        tenantId: null,
        delete: async () => {},
        getIdToken: async () => 'mock-id-token',
        getIdTokenResult: async () => ({ token: 'mock-id-token', claims: {} }),
        reload: async () => {},
        toJSON: () => ({ uid: 'test-user', email: 'test@example.com' }),
        phoneNumber: null,
        photoURL: null,
      };

      // Store mock user globally for Firebase SDK to use
      (window as any).__FIREBASE_MOCK_USER__ = mockUser;
    });

    // Mock auth token endpoint
    await page.route('**/api/auth/token', async route => {
      await route.fulfill({
        status: 200,
        body: 'mock-auth-token',
      });
    });

    // Mock categories endpoint
    await page.route('**/categories', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'cat-civil',
              name: 'Civil',
              icon: '⚖️',
              description: 'Civil law templates',
              templateCount: 5,
              order: 1
            },
          ],
        }),
      });
    });

    // Mock templates endpoint
    await page.route('**/templates?**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'tpl-1',
              name: 'Rent Agreement',
              description: 'Standard rent agreement template',
              categoryId: 'cat-civil',
              categoryName: 'Civil',
              estimatedMinutes: 10,
              usageCount: 42,
            },
          ],
          pagination: {
            page: 1,
            limit: 20,
            total: 1,
            totalPages: 1,
          },
        }),
      });
    });

    // Mock single template endpoint
    await page.route('**/templates/tpl-1', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'tpl-1',
            name: 'Rent Agreement',
            description: 'Standard rent agreement template',
            categoryId: 'cat-civil',
            categoryName: 'Civil',
            estimatedMinutes: 10,
            variables: [
              {
                name: 'landlord_name',
                label: 'Landlord Name',
                type: 'STRING',
                required: true,
                order: 1,
                placeholder: 'Enter landlord name',
                minLength: 0,
                maxLength: 0,
                pattern: '',
              },
              {
                name: 'tenant_name',
                label: 'Tenant Name',
                type: 'STRING',
                required: true,
                order: 2,
                placeholder: 'Enter tenant name',
                minLength: 0,
                maxLength: 0,
                pattern: '',
              },
              {
                name: 'rent_amount',
                label: 'Monthly Rent',
                type: 'CURRENCY',
                required: true,
                order: 3,
                placeholder: 'Enter monthly rent',
                minLength: 0,
                maxLength: 0,
                pattern: '',
              },
            ],
          },
        }),
      });
    });

    // Mock drafts creation endpoint
    await page.route('**/drafts', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              draftId: 'draft-123',
              downloadUrl: 'https://storage.example.com/draft-123.docx',
              expiresAt: new Date(Date.now() + 86400000).toISOString(),
            },
          }),
        });
      }
    });

    // Mock user profile endpoint
    await page.route('**/user/profile', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            uid: 'test-user',
            displayName: 'Test User',
            email: 'test@example.com',
            phone: '',
            plan: 'free',
            draftsUsedThisMonth: 2,
            draftsLimit: 10,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
      });
    });
  });

  test('displays dashboard with categories', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page.getByTestId('dashboard-page')).toBeVisible();
    await expect(page.getByTestId('dashboard-heading')).toBeVisible();
    await expect(page.getByTestId('categories-grid')).toBeVisible();
    await expect(page.getByTestId('category-cat-civil')).toBeVisible();
  });

  test('navigates to category and shows templates', async ({ page }) => {
    await page.goto('/category/cat-civil');

    await expect(page.getByTestId('category-page')).toBeVisible();
    await expect(page.getByTestId('templates-list')).toBeVisible();
    await expect(page.getByTestId('template-tpl-1')).toBeVisible();
  });

  test('shows template form with all fields', async ({ page }) => {
    await page.goto('/template/tpl-1');

    await expect(page.getByTestId('template-page')).toBeVisible();
    await expect(page.getByTestId('generate-button')).toBeVisible();

    // Check that form fields are rendered
    await expect(page.getByPlaceholder('Enter landlord name')).toBeVisible();
    await expect(page.getByPlaceholder('Enter tenant name')).toBeVisible();
    await expect(page.getByPlaceholder('Enter monthly rent')).toBeVisible();
  });

  test('disables generate button when required fields are empty', async ({ page }) => {
    await page.goto('/template/tpl-1');

    // Button should be disabled when no fields are filled
    const generateButton = page.getByTestId('generate-button');
    await expect(generateButton).toBeDisabled();

    // Fill one field - button should still be disabled
    await page.getByPlaceholder('Enter landlord name').fill('John Doe');
    await expect(generateButton).toBeDisabled();

    // Fill another field - button should still be disabled
    await page.getByPlaceholder('Enter tenant name').fill('Jane Smith');
    await expect(generateButton).toBeDisabled();

    // Fill all required fields - button should now be enabled
    await page.getByPlaceholder('Enter monthly rent').fill('25000');
    await expect(generateButton).toBeEnabled();
  });

  test('generates draft successfully with valid data', async ({ page }) => {
    await page.goto('/template/tpl-1');

    // Fill all required fields
    await page.getByPlaceholder('Enter landlord name').fill('John Doe');
    await page.getByPlaceholder('Enter tenant name').fill('Jane Smith');
    await page.getByPlaceholder('Enter monthly rent').fill('25000');

    // Submit form
    await page.getByTestId('generate-button').click();

    // Should navigate to success page
    await expect(page).toHaveURL(/\/draft\/draft-123/);
    await expect(page.getByTestId('draft-success-page')).toBeVisible();
    await expect(page.getByTestId('success-heading')).toBeVisible();
    await expect(page.getByTestId('download-button')).toBeVisible();
  });

  test('can navigate back to dashboard from success page', async ({ page }) => {
    await page.goto('/draft/draft-123?downloadUrl=https://example.com/draft.docx&templateName=Rent%20Agreement');

    await expect(page.getByTestId('dashboard-link')).toBeVisible();
    await page.getByTestId('dashboard-link').click();

    await expect(page).toHaveURL(/\/dashboard/);
  });
});

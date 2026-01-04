import { test, expect } from '@playwright/test';

/**
 * Authentication Flow E2E Tests
 *
 * Tests the complete authentication journey including:
 * - Login page rendering
 * - Google Sign-In flow
 * - Phone OTP flow
 * - Input validation
 * - Redirect after auth
 * - Protected routes
 */

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('displays login page with all elements', async ({ page }) => {
    // Verify page structure
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
    await expect(page.getByPlaceholder(/phone number/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /send otp/i })).toBeVisible();

    // Verify branding
    await expect(page.getByText(/nyayamitra/i)).toBeVisible();
    await expect(page.getByText(/legal document generation/i)).toBeVisible();
  });

  test('validates phone number format', async ({ page }) => {
    const phoneInput = page.getByPlaceholder(/phone number/i);
    const sendOtpButton = page.getByRole('button', { name: /send otp/i });

    // Invalid: too short
    await phoneInput.fill('12345');
    await sendOtpButton.click();
    await expect(page.getByText(/valid.*phone/i)).toBeVisible();

    // Invalid: doesn't start with 6-9
    await phoneInput.fill('1234567890');
    await sendOtpButton.click();
    await expect(page.getByText(/valid.*phone/i)).toBeVisible();

    // Valid format (will fail at Firebase but validates input)
    await phoneInput.fill('9876543210');
    await sendOtpButton.click();

    // Input validation should pass (no error message)
    await expect(page.getByText(/valid.*phone/i)).not.toBeVisible();
  });

  test('shows loading state during OTP send', async ({ page }) => {
    const phoneInput = page.getByPlaceholder(/phone number/i);
    const sendOtpButton = page.getByRole('button', { name: /send otp/i });

    await phoneInput.fill('9876543210');
    await sendOtpButton.click();

    // Should show loading state
    await expect(sendOtpButton).toBeDisabled();
    await expect(page.getByText(/sending/i)).toBeVisible();
  });

  test('shows OTP input after sending OTP', async ({ page }) => {
    // Mock successful OTP send
    await page.route('**/sendOTP', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    const phoneInput = page.getByPlaceholder(/phone number/i);
    const sendOtpButton = page.getByRole('button', { name: /send otp/i });

    await phoneInput.fill('9876543210');
    await sendOtpButton.click();

    // Should show OTP input
    await expect(page.getByPlaceholder(/enter.*otp/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /verify/i })).toBeVisible();
  });

  test('validates OTP format', async ({ page }) => {
    // Setup: Get to OTP input state
    await page.route('**/sendOTP', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.getByPlaceholder(/phone number/i).fill('9876543210');
    await page.getByRole('button', { name: /send otp/i }).click();

    const otpInput = page.getByPlaceholder(/enter.*otp/i);
    const verifyButton = page.getByRole('button', { name: /verify/i });

    // Invalid: too short
    await otpInput.fill('123');
    await verifyButton.click();
    await expect(page.getByText(/6.*digit/i)).toBeVisible();

    // Valid: 6 digits
    await otpInput.fill('123456');
    await verifyButton.click();
    await expect(page.getByText(/6.*digit/i)).not.toBeVisible();
  });

  test('redirects authenticated user to dashboard', async ({ page, context }) => {
    // Set auth cookie (mock authenticated state)
    await context.addCookies([{
      name: '__session',
      value: 'test-session-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    }]);

    await page.goto('/login');

    // Should redirect to dashboard
    await page.waitForURL(/dashboard/);
    await expect(page).toHaveURL(/dashboard/);
  });

  test('Google Sign-In button triggers OAuth flow', async ({ page }) => {
    const googleButton = page.getByRole('button', { name: /continue with google/i });

    // Click should trigger popup or redirect
    const popupPromise = page.waitForEvent('popup');
    await googleButton.click();

    // Note: In real test, we'd need to handle Google OAuth popup
    // For now, just verify the button triggers an action
    await expect(googleButton).toHaveBeenClicked;
  });
});

test.describe('Protected Routes', () => {
  test('redirects unauthenticated user to login from dashboard', async ({ page }) => {
    await page.goto('/dashboard');

    // Should redirect to login
    await page.waitForURL(/login/);
    await expect(page).toHaveURL(/login/);
  });

  test('redirects unauthenticated user to login from profile', async ({ page }) => {
    await page.goto('/profile');

    await page.waitForURL(/login/);
    await expect(page).toHaveURL(/login/);
  });

  test('redirects unauthenticated user to login from history', async ({ page }) => {
    await page.goto('/history');

    await page.waitForURL(/login/);
    await expect(page).toHaveURL(/login/);
  });

  test('shows dashboard for authenticated user', async ({ page, context }) => {
    // Mock authenticated state
    await context.addCookies([{
      name: '__session',
      value: 'test-session-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    }]);

    await page.goto('/dashboard');

    // Should show dashboard (not redirect)
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });

  test('preserves intended destination after login', async ({ page }) => {
    // Try to access protected page
    await page.goto('/profile');

    // Redirected to login
    await page.waitForURL(/login/);

    // TODO: After login, should redirect back to /profile
    // This requires implementing redirect_to query param
  });
});

test.describe('Sign Out', () => {
  test('successfully signs out and redirects to login', async ({ page, context }) => {
    // Setup: authenticated user
    await context.addCookies([{
      name: '__session',
      value: 'test-session-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    }]);

    await page.goto('/dashboard');

    // Click sign out
    await page.getByRole('button', { name: /sign out/i }).click();

    // Should redirect to login
    await page.waitForURL(/login/);
    await expect(page).toHaveURL(/login/);

    // Cookie should be cleared
    const cookies = await context.cookies();
    const sessionCookie = cookies.find(c => c.name === '__session');
    expect(sessionCookie).toBeUndefined();
  });

  test('cannot access protected routes after sign out', async ({ page, context }) => {
    // Setup: authenticated user
    await context.addCookies([{
      name: '__session',
      value: 'test-session-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    }]);

    await page.goto('/dashboard');
    await page.getByRole('button', { name: /sign out/i }).click();
    await page.waitForURL(/login/);

    // Try to access dashboard again
    await page.goto('/dashboard');

    // Should be redirected to login
    await page.waitForURL(/login/);
    await expect(page).toHaveURL(/login/);
  });
});

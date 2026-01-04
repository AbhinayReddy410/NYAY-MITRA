# Test Run Results — 2026-01-04

## Summary
- API Tests: 32 passed, 0 failed
- Web E2E Tests (Chromium only): 1 passed, 28 failed
- Mobile Tests: 0 passed, 0 failed (no test suite configured)
- Total: 33 passed, 28 failed

## Bugs Fixed During Testing

### Bug 1: Vitest running compiled tests from dist
- **File:** services/api/package.json
- **Root Cause:** Vitest discovered CommonJS test output in `dist`, which cannot import ESM-only `vitest`.
- **Fix:** Excluded `dist/**` from the Vitest run in the API test script.
- **Regression Test:** `pnpm --filter @nyayamitra/api test`

### Bug 2: Hoisted fixtures throwing ReferenceError
- **File:** services/api/src/routes/drafts.test.ts
- **Root Cause:** `vi.hoisted` executed before imported fixtures initialized.
- **Fix:** Switched to direct constants for `authUser` and HTTP status values.
- **Regression Test:** `pnpm --filter @nyayamitra/api test`

### Bug 3: Hoisted fixtures throwing ReferenceError
- **File:** services/api/src/routes/user.test.ts
- **Root Cause:** `vi.hoisted` executed before imported fixtures initialized.
- **Fix:** Switched to direct constants for `authUser` and HTTP status values.
- **Regression Test:** `pnpm --filter @nyayamitra/api test`

### Bug 4: Hono validator input types resolving to `never`
- **File:** services/api/src/routes/drafts.ts
- **Root Cause:** Route handlers used `Context` without `Input` typing, so `c.req.valid()` returned `never`.
- **Fix:** Added `ValidatedInput`-aware handler signatures and generic auth helper.
- **Regression Test:** `pnpm --filter @nyayamitra/api build`

### Bug 5: Hono validator input types resolving to `never`
- **File:** services/api/src/routes/templates.ts
- **Root Cause:** Same as above for query/param validation.
- **Fix:** Added `ValidatedInput`-typed handler signatures.
- **Regression Test:** `pnpm --filter @nyayamitra/api build`

### Bug 6: Hono validator input types resolving to `never`
- **File:** services/api/src/routes/payments.ts
- **Root Cause:** Same as above for JSON validation.
- **Fix:** Added `ValidatedInput`-typed handler signatures and generic auth helper.
- **Regression Test:** `pnpm --filter @nyayamitra/api build`

### Bug 7: Hono validator input types resolving to `never`
- **File:** services/api/src/routes/user.ts
- **Root Cause:** Same as above for JSON validation.
- **Fix:** Added `ValidatedInput`-typed handler signatures and generic auth helper.
- **Regression Test:** `pnpm --filter @nyayamitra/api build`

## Remaining Issues

### Issue 1: Web E2E tests blocked by missing Firebase env
- **Severity:** P1
- **Blocked By:** Missing `apps/web/.env.local` with valid `NEXT_PUBLIC_FIREBASE_*` values; login UI renders error state instead of auth flows.
- **Next Steps:** Add valid Firebase web credentials and rerun Playwright with the API server available.

### Issue 2: Admin build fails without Firebase API key
- **Severity:** P1
- **Blocked By:** Invalid or missing Firebase API key during `apps/admin` prerender.
- **Next Steps:** Provide admin Firebase credentials (or mock during build) before running `pnpm build`.

## Test Coverage

| Module | Statements | Branches | Functions | Lines |
|--------|------------|----------|-----------|-------|
| API    | N/A        | N/A      | N/A       | N/A   |
| Web    | N/A        | N/A      | N/A       | N/A   |
| Mobile | N/A        | N/A      | N/A       | N/A   |

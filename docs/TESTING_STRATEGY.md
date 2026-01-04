# Comprehensive Testing Strategy - NyayaMitra

## Overview

This document outlines the complete testing strategy implemented for NyayaMitra, including integration tests, E2E tests, and the systematic bug fixes required.

## Test Coverage Goals

| Layer | Tool | Coverage Target | Status |
|-------|------|----------------|--------|
| API Integration | Vitest + Firebase Emulator | All endpoints | ⚠️ Infrastructure Ready |
| Web E2E | Playwright | Auth + Draft Generation | 🔴 Blocked by User type |
| Mobile E2E | Detox | Critical User Journeys | 🔴 Blocked by NativeWind |
| Component Integration | React Testing Library | Forms, State Management | 🔴 Blocked by types |

## Critical Blockers Identified

### P0 - Must Fix Immediately

#### 1. Mobile App: NativeWind Type Configuration (100+ errors)
**Impact**: Blocks ALL mobile screen testing

**Issue**: `className` prop not recognized on React Native components

**Root Cause**: Incomplete NativeWind 4 setup
- Missing type declarations
- `nativewind/types` not in tsconfig
- Babel/Metro config may be incomplete

**Fix Required**:
```bash
# 1. Add types to tsconfig
cd apps/mobile
# Update tsconfig.json to include nativewind/types

# 2. Verify tailwind.config.js has NativeWind preset

# 3. Check babel.config.js for nativewind/babel plugin
```

**Files Affected**: ALL React Native component files (100+ errors)

**Estimated Fix Time**: 30-60 minutes

---

#### 2. Web App: User Type Mismatch (9 errors)
**Impact**: Blocks web auth and profile testing

**Issue**: Code uses Firebase `User` type (with `uid`, `phoneNumber`) but expects custom `User` type (with `id`, `phone`)

**Files Affected**:
- `src/app/(main)/history/page.tsx`
- `src/app/(main)/layout.tsx`
- `src/app/(main)/profile/page.tsx`

**Root Cause**: Mixing Firebase Auth User with custom domain User type

**Fix Strategy**:
1. Create user mapper: `FirebaseUser → DomainUser`
2. Use consistent type throughout frontend
3. Add type guards where needed

**Estimated Fix Time**: 30 minutes

---

#### 3. API: Hono Validator Type Errors (8 errors)
**Impact**: Prevents API route testing

**Issue**: `c.req.valid('json')` returns `never` type

**Files Affected**:
- `src/routes/drafts.ts`
- `src/routes/payments.ts`
- `src/routes/templates.ts`
- `src/routes/user.ts`

**Root Cause**: Version mismatch between `hono` v4.11.3 and `@hono/zod-validator` v0.7.6

**Fix Strategy**:
```bash
# Check for compatible versions
pnpm --filter @nyayamitra/api update hono @hono/zod-validator

# Or add explicit type casting
const body = c.req.valid('json') as CreateDraftRequest;
```

**Estimated Fix Time**: 20 minutes

---

### P1 - High Priority (Fix Before Test Writing)

#### 4. API: Firestore Mock Type Errors (30+ errors)
**Impact**: Existing tests fail to compile

**Issue**: Mock objects missing required CollectionReference properties

**Fix Strategy**:
Use type assertion:
```typescript
const mockCollection = {
  doc: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  // ... minimal interface
} as unknown as CollectionReference<T>;
```

**Estimated Fix Time**: 1 hour

---

#### 5. API: Error Handler Status Code Type
**Impact**: Error responses fail type checking

**File**: `src/middleware/errorHandler.ts:20`

**Issue**: `number` not assignable to `ContentfulStatusCode`

**Fix**:
```typescript
import type { StatusCode } from 'hono/utils/http-status';

// Use literal types or cast
return c.json({ error }, statusCode as StatusCode);
```

**Estimated Fix Time**: 10 minutes

---

#### 6. Mobile: Missing @types/node
**Impact**: `app.config.ts` fails to compile

**Fix**:
```bash
pnpm --filter @nyayamitra/mobile add -D @types/node
```

**Estimated Fix Time**: 2 minutes

---

### P2 - Medium Priority (Can Fix During Test Writing)

#### 7. API: Razorpay Entity Access (4 errors)
**Issue**: `?.entity` may be undefined

**Fix**: Add optional chaining or type guards

---

#### 8. Web: ESLint - require() Forbidden (2 errors)
**Issue**: AuthContext uses `require()` instead of `import()`

**Fix**: Use dynamic `import()` for code splitting

---

#### 9. Web: Unused Variables (2 errors)
**Issue**: `phoneNumber`, `code` defined but never used

**Fix**: Remove or prefix with `_`

---

### P3 - Low Priority (Warnings)

#### 10. Web: Hook Dependency Warnings (3 warnings)
**Issue**: useMemo/useCallback dependency arrays

---

## Test Files Created

### API Integration Tests (Planned)

```
services/api/src/test/
├── setup.ts                           ✅ Created
├── fixtures.ts                        ✅ Created
└── integration/
    ├── categories.integration.test.ts 🔜 Pending
    ├── drafts.integration.test.ts     🔜 Pending
    ├── templates.integration.test.ts  🔜 Pending
    └── user.integration.test.ts       🔜 Pending
```

### Web E2E Tests (Planned)

```
apps/web/
├── playwright.config.ts               🔜 Pending
└── e2e/
    ├── auth.spec.ts                   🔜 Pending
    ├── draft-generation.spec.ts       🔜 Pending
    └── profile.spec.ts                🔜 Pending
```

### Mobile Tests (Planned)

```
apps/mobile/
├── jest.config.js                     🔜 Pending
├── jest.setup.js                      🔜 Pending
└── components/__tests__/
    ├── DynamicForm.test.tsx           🔜 Pending
    └── ...                            🔜 Pending
```

## Prerequisites for Testing

### Firebase Emulator Setup

```bash
# Install Firebase tools globally
npm install -g firebase-tools

# Start emulators (run in separate terminal)
firebase emulators:start --only firestore,auth

# Or configure in firebase.json
{
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 }
  }
}
```

### Playwright Setup

```bash
cd apps/web
pnpm add -D @playwright/test
npx playwright install chromium
```

### React Native Testing Library Setup

```bash
cd apps/mobile
pnpm add -D @testing-library/react-native @testing-library/jest-native jest jest-expo
```

## Next Steps

### Immediate (Before Any Tests)

1. ✅ Complete bug audit → `docs/BUG_AUDIT.md`
2. ⚠️ Fix P0 blockers (estimated 2-3 hours)
3. ⚠️ Verify TypeScript compilation across all packages
4. ⚠️ Fix P1 issues (estimated 1-2 hours)

### Phase 1: API Integration Tests

1. ⚠️ Setup Firebase emulator configuration
2. ⚠️ Write category endpoint tests
3. ⚠️ Write draft generation tests
4. ⚠️ Write template endpoint tests
5. ⚠️ Write user endpoint tests
6. ⚠️ Achieve 80%+ API route coverage

### Phase 2: Web E2E Tests

1. ⚠️ Install and configure Playwright
2. ⚠️ Write auth flow tests (Google + Phone OTP)
3. ⚠️ Write draft generation journey test
4. ⚠️ Write profile management tests
5. ⚠️ Write error handling tests (limit exceeded, etc.)

### Phase 3: Mobile Component Tests

1. ⚠️ Setup Jest + React Native Testing Library
2. ⚠️ Write DynamicForm integration tests
3. ⚠️ Write AuthContext tests
4. ⚠️ Write navigation tests
5. ⚠️ Write API client integration tests

### Phase 4: CI/CD Integration

1. ⚠️ Add GitHub Actions workflow
2. ⚠️ Run tests on PR
3. ⚠️ Block merge on test failure
4. ⚠️ Generate coverage reports

## Test Execution Commands

### Run All Tests
```bash
pnpm test
```

### Run API Tests Only
```bash
pnpm --filter @nyayamitra/api test
```

### Run Web E2E Tests
```bash
cd apps/web
pnpm test:e2e
```

### Run Mobile Tests
```bash
cd apps/mobile
pnpm test
```

### Run Single Test File
```bash
pnpm --filter @nyayamitra/api test -- src/routes/drafts.integration.test.ts
```

### Watch Mode
```bash
pnpm --filter @nyayamitra/api test -- --watch
```

## Success Criteria

- ✅ 80%+ API route coverage
- ✅ All critical user journeys covered in E2E tests
- ✅ All form validation scenarios tested
- ✅ Auth flows fully tested (Google + Phone OTP)
- ✅ Draft generation tested end-to-end
- ✅ Error handling tested (limits, validation, etc.)
- ✅ All tests pass in CI/CD pipeline
- ✅ Zero TypeScript errors
- ✅ Zero ESLint errors (excluding warnings)

## Current Status Summary

**Tests Written**: 2 / ~50 planned (4%)

**Blockers**:
- 🔴 P0: 3 critical issues blocking all test development
- 🟡 P1: 3 high-priority issues affecting test compilation
- 🟢 P2: 4 medium-priority issues (can proceed)
- 🟢 P3: 1 low-priority warnings

**Estimated Time to First Green Test Suite**:
- Bug fixes: 4-6 hours
- Test infrastructure: 2-3 hours
- Test writing: 8-12 hours
- **Total: 14-21 hours**

## Recommendations

### Short-term (This Session)

1. **Focus on fixing P0 blockers** - without these fixes, no testing is possible
2. **Create test infrastructure files** - even if they can't run yet, document the approach
3. **Document all bugs comprehensively** - create audit trail for future reference

### Medium-term (Next Session)

1. **Fix all P1 issues** systematically
2. **Implement API integration tests** (highest value, fewest blockers)
3. **Setup CI/CD** to prevent regression

### Long-term

1. **Implement E2E tests** after core bugs fixed
2. **Add visual regression testing** with Percy or similar
3. **Performance testing** with Lighthouse CI
4. **Security testing** with OWASP ZAP

---

*Last Updated: 2026-01-04*
*Next Review: After P0 bugs fixed*

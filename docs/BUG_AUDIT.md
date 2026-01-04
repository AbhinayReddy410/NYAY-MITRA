# Bug Audit Report - NyayaMitra Testing Initiative

Generated: 2026-01-04

## Executive Summary

- **Total TypeScript Errors**: ~50+
- **Total ESLint Errors**: 4 blocking, 4 warnings
- **Severity Distribution**:
  - **Blocking** (prevents testing): 15+
  - **Degraded** (tests can proceed): 30+
  - **Cosmetic** (warnings only): 4

---

## WEB APP (apps/web)

### TypeScript Errors

#### 1. User type missing 'id' and 'phone' properties
**Files affected**:
- `src/app/(main)/history/page.tsx:70`
- `src/app/(main)/layout.tsx:77,78,131,132`
- `src/app/(main)/profile/page.tsx:142,177,178`

**Error**:
```
Property 'id' does not exist on type 'User'
Property 'phone' does not exist on type 'User'
```

**Root Cause**:
- Firebase `User` type being used instead of custom `@nyayamitra/shared` User type
- Firebase User has `uid` not `id`, and `phoneNumber` not `phone`

**Severity**: BLOCKING - Prevents compilation

**Fix Required**:
1. Check if using Firebase User vs custom User type
2. Either map Firebase User → custom User, or use correct property names
3. Add type guards to distinguish between user types

---

### ESLint Errors

#### 1. Forbidden require() imports in AuthContext
**File**: `src/contexts/AuthContext.tsx:11,53`

**Error**:
```
A `require()` style import is forbidden. @typescript-eslint/no-require-imports
```

**Root Cause**:
- Using `require()` for Firebase imports instead of ES6 imports
- Likely workaround for SSR/client-side code splitting

**Severity**: BLOCKING (ESLint error)

**Fix Required**:
1. Replace `require()` with dynamic `import()`
2. Use Next.js `'use client'` directive if needed
3. Configure ESLint to allow require in specific contexts if necessary

---

#### 2. Unused variables in AuthContext
**File**: `src/contexts/AuthContext.tsx:100,104`

**Error**:
```
'phoneNumber' is defined but never used
'code' is defined but never used
```

**Severity**: DEGRADED

**Fix Required**:
- Remove unused variables or prefix with `_` if intentionally unused

---

#### 3. Hook dependency warnings
**File**: `src/app/(main)/template/[id]/page.tsx:719,754`

**Severity**: DEGRADED (warnings)

**Fix Required**:
- Wrap object initialization in useMemo
- Pass inline function to useCallback

---

## MOBILE APP (apps/mobile)

### TypeScript Errors

#### 1. Missing @types/node
**File**: `app.config.ts:13,14,15,16`

**Error**:
```
Cannot find name 'process'. Do you need to install type definitions for node?
```

**Root Cause**: Missing `@types/node` dev dependency

**Severity**: BLOCKING

**Fix Required**:
```bash
pnpm --filter @nyayamitra/mobile add -D @types/node
```

---

#### 2. Export assignment incompatible with ES modules
**File**: `app.config.ts:21`

**Error**:
```
Export assignment cannot be used when targeting ECMAScript modules
```

**Root Cause**: Using `export =` syntax with ES modules target

**Severity**: BLOCKING

**Fix Required**:
- Change to `export default` or named exports

---

#### 3. NativeWind className prop errors (100+ errors)
**Files**: `app/(auth)/login.tsx` and likely all React Native components

**Error**:
```
Property 'className' does not exist on type 'IntrinsicAttributes & ...'
```

**Root Cause**:
- NativeWind 4 setup incomplete
- Missing NativeWind type declarations
- `nativewind/types` not properly configured in tsconfig

**Severity**: BLOCKING - Affects all screens

**Fix Required**:
1. Ensure `nativewind/types` in tsconfig types array
2. Verify NativeWind preset in `tailwind.config.js`
3. Check babel/metro config for NativeWind plugin

---

## API SERVICE (services/api)

### TypeScript Errors

#### 1. Hono validator type errors
**Files**:
- `src/routes/drafts.ts:156,222`
- `src/routes/payments.ts:64,79`
- `src/routes/templates.ts:47,91`
- `src/routes/user.ts:126`

**Error**:
```
Argument of type '"json"' is not assignable to parameter of type 'never'
```

**Root Cause**:
- Incorrect Hono type inference
- `c.req.valid()` type parameter mismatch
- Likely `@hono/zod-validator` version incompatibility

**Severity**: BLOCKING

**Fix Required**:
1. Update `hono` and `@hono/zod-validator` to compatible versions
2. Check Hono type definitions
3. May need explicit type casting

---

#### 2. Error handler status code type mismatch
**File**: `src/middleware/errorHandler.ts:20`

**Error**:
```
Argument of type 'number' is not assignable to parameter of type 'ContentfulStatusCode'
```

**Root Cause**: Hono expects literal status codes, not number type

**Severity**: BLOCKING

**Fix Required**:
- Cast status code to `StatusCode` type
- Use Hono's status code constants

---

#### 3. Mock type mismatches in tests
**Files**:
- `src/routes/categories.test.ts:118,137,153`
- `src/routes/drafts.test.ts:403,419,420,421`
- `src/routes/templates.test.ts:205,231,243,254`
- `src/routes/user.test.ts:157,180,198,231,269,299`

**Error**:
```
Type 'Query<Category>' is missing properties from type 'CollectionReference<Category>'
Type 'UsersCollection' is missing properties from type 'CollectionReference<User>'
```

**Root Cause**:
- Incomplete mock implementations
- Firestore type definitions require full CollectionReference interface

**Severity**: DEGRADED (tests affected but can be fixed)

**Fix Required**:
1. Create complete mock factory functions
2. Use `as unknown as CollectionReference<T>` type assertion
3. Implement minimum required methods for tests

---

#### 4. DecodedIdToken mock incomplete
**Files**: `src/routes/drafts.test.ts:15`, `src/routes/user.test.ts:13`

**Error**:
```
Type '{ uid, email, name }' is missing properties from type 'DecodedIdToken'
```

**Severity**: DEGRADED

**Fix Required**:
- Add missing required properties: `aud`, `auth_time`, `exp`, `firebase`, `iat`, `iss`, `sub`

---

#### 5. Razorpay type errors
**File**: `src/services/razorpayService.ts:116,140,160,182`

**Error**:
```
Property 'entity' does not exist on type '{ entity?: {...} | undefined } | undefined'
```

**Root Cause**: Optional chaining needed or incorrect Razorpay types

**Severity**: BLOCKING

**Fix Required**:
- Use optional chaining: `?.entity`
- Add type guards
- Update Razorpay types

---

#### 6. Implicit 'any' in middleware mocks
**Files**: `src/routes/categories.test.ts:14`, `src/routes/drafts.test.ts:43`, `src/routes/user.test.ts:31`

**Error**:
```
Parameter 'c' implicitly has an 'any' type
Parameter 'next' implicitly has an 'any' type
```

**Severity**: DEGRADED

**Fix Required**:
- Add explicit types: `(c: Context, next: Next) => ...`

---

## PRIORITY FIXES (Must fix before testing)

### P0 - Critical (Blocks all testing)
1. ✅ Fix NativeWind types in mobile app - affects all screens
2. ✅ Fix Hono validator types in API - affects all routes
3. ✅ Fix User type mismatch in web app - affects auth flows

### P1 - High (Blocks specific test suites)
1. ✅ Fix Firestore mock types in API tests
2. ✅ Fix error handler status codes
3. ✅ Add @types/node to mobile app

### P2 - Medium (Degraded experience)
1. ✅ Fix Razorpay optional entity access
2. ✅ Fix DecodedIdToken mocks
3. ✅ Remove unused variables

### P3 - Low (Warnings only)
1. ✅ Fix hook dependency warnings
2. ✅ Replace img with Image component
3. ✅ Add explicit middleware types

---

## Next Steps

1. **Fix P0 issues** (estimated 2-3 hours)
2. **Verify TypeScript compilation** across all packages
3. **Fix P1 issues** (estimated 1-2 hours)
4. **Proceed with test infrastructure setup**
5. **Address P2/P3 during test writing**

---

## Test Infrastructure Readiness

- ❌ **Web**: Cannot proceed until User type fixed
- ❌ **Mobile**: Cannot proceed until NativeWind types fixed
- ⚠️ **API**: Can proceed with mock type assertions, fix during test writing

# CLAUDE.md — NyayaMitra Project Context

> **CRITICAL**: Read this entire file before any action. This is your operating manual.

## Project Identity

**Name**: NyayaMitra  
**Purpose**: Legal draft generation platform for Indian advocates  
**Pattern**: Structured Input → Validation → Template Merge → .docx Export  
**What this is NOT**: AI content generator, document editor, case management system, chatbot

## Operational Commands

```bash
# Root
pnpm install          # Install all dependencies
pnpm build            # Build all packages
pnpm dev              # Run all dev servers
pnpm lint             # Lint all packages
pnpm test             # Run all tests
pnpm clean            # Clean all dist folders

# API (services/api)
pnpm --filter @nyayamitra/api dev      # Start API dev server
pnpm --filter @nyayamitra/api test     # Run API tests
pnpm --filter @nyayamitra/api build    # Build API

# Mobile (apps/mobile)
pnpm --filter @nyayamitra/mobile start # Start Expo
pnpm --filter @nyayamitra/mobile ios   # Run iOS simulator
pnpm --filter @nyayamitra/mobile android # Run Android emulator

# Web (apps/web)
pnpm --filter @nyayamitra/web dev      # Start Next.js dev
pnpm --filter @nyayamitra/web build    # Build for production

# Shared (packages/shared)
pnpm --filter @nyayamitra/shared build # Build shared types

# Single test file
pnpm --filter @nyayamitra/api test -- src/routes/drafts.test.ts
```

## Project Structure

```
nyayamitra/
├── apps/
│   ├── mobile/              # Expo React Native (iOS + Android)
│   │   ├── app/             # Expo Router pages
│   │   ├── components/      # React Native components
│   │   ├── contexts/        # React contexts (Auth, etc.)
│   │   ├── hooks/           # Custom hooks
│   │   └── services/        # API client, Firebase
│   ├── web/                 # Next.js 14 (App Router)
│   │   ├── src/app/         # Pages and layouts
│   │   ├── src/components/  # React components
│   │   ├── src/lib/         # Utilities, API client
│   │   └── src/contexts/    # React contexts
│   └── admin/               # Next.js admin panel
├── packages/
│   └── shared/              # Shared TypeScript types, validation, constants
│       └── src/
│           ├── types/       # Domain types (User, Template, Draft, etc.)
│           ├── validation/  # Zod schemas
│           └── constants/   # Error codes, limits, enums
├── services/
│   └── api/                 # Cloud Run API (Hono + Node.js)
│       └── src/
│           ├── routes/      # API route handlers
│           ├── services/    # Business logic
│           ├── middleware/  # Auth, logging, errors
│           └── lib/         # Firebase, Typesense, Storage
├── scripts/                 # CLI tools (import, migrate, seed)
├── infra/
│   ├── terraform/           # GCP infrastructure
│   └── firebase/            # Firestore/Storage rules
└── docs/                    # Documentation
```

## Technology Stack — DO NOT DEVIATE

| Layer | Technology | Version | Notes |
|-------|------------|---------|-------|
| Mobile | Expo SDK | 52 | With Expo Router v4 |
| Mobile Styling | NativeWind | 4 | Tailwind for RN |
| Web | Next.js | 14 | App Router only |
| Web Styling | Tailwind CSS | 3 | No CSS modules |
| API Framework | Hono | 4 | On Cloud Run |
| Runtime | Node.js | 20 LTS | |
| Database | Firestore | — | Mumbai region |
| Storage | Cloud Storage | — | Mumbai region |
| Auth | Firebase Auth | — | Google + Phone OTP |
| Search | Typesense Cloud | 0.25 | Mumbai PoP |
| Payments | Razorpay | — | INR subscriptions |
| Validation | Zod | 3 | All API inputs |
| HTTP Client | ky | 1 | Browser + Node |
| Doc Generation | docxtemplater | — | With PizZip |

## Coding Standards — ENFORCED

### TypeScript
- **Strict mode always** — No `any` type, no `@ts-ignore`
- **Explicit return types** on all functions
- **Named exports only** — No default exports
- **No enums** — Use `as const` objects or union types

### File Naming
```
components/     → PascalCase.tsx     (e.g., LoginScreen.tsx)
hooks/          → camelCase.ts       (e.g., useAuth.ts)
services/       → camelCase.ts       (e.g., api.ts)
types/          → camelCase.ts       (e.g., template.ts)
routes/         → camelCase.ts       (e.g., drafts.ts)
tests/          → *.test.ts          (e.g., drafts.test.ts)
```

### Code Style
- **No comments** explaining obvious code
- **No console.log** — Use structured logger
- **No magic numbers** — Use named constants
- **No nested ternaries** — Use early returns
- **Async/await** — No raw Promises or callbacks
- **Functional components** — No React class components

### Imports Order
```typescript
// 1. Node built-ins
import { readFile } from 'fs/promises';

// 2. External packages
import { Hono } from 'hono';
import { z } from 'zod';

// 3. Workspace packages
import { User, Template } from '@nyayamitra/shared';

// 4. Local imports (relative)
import { db } from '../lib/firebase';
import { validateVariables } from '../services/validation';
```

## API Patterns

### Request Validation
```typescript
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const CreateDraftSchema = z.object({
  templateId: z.string().min(1),
  variables: z.record(z.unknown()),
});

app.post('/drafts', zValidator('json', CreateDraftSchema), async (c) => {
  const body = c.req.valid('json');
  // body is typed
});
```

### Response Format
```typescript
// Success (single item)
return c.json({ data: result });

// Success (list with pagination)
return c.json({
  data: items,
  pagination: { page, limit, total, totalPages }
});

// Error
return c.json({
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid template ID',
    details: [{ field: 'templateId', message: 'Required' }]
  }
}, 400);
```

### Error Codes
```typescript
// Use these exact codes — defined in @nyayamitra/shared
AUTH_REQUIRED        // 401 - No token
AUTH_INVALID         // 401 - Invalid/expired token
FORBIDDEN            // 403 - Not authorized
NOT_FOUND            // 404 - Resource not found
VALIDATION_ERROR     // 400 - Input validation failed
DRAFT_LIMIT_EXCEEDED // 402 - Monthly limit reached
GENERATION_FAILED    // 500 - Document generation error
PAYMENT_REQUIRED     // 402 - Subscription required
RATE_LIMITED         // 429 - Too many requests
INTERNAL_ERROR       // 500 - Unexpected error
```

## Firebase Patterns

### Firestore Access (API only)
```typescript
import { db } from '@/lib/firebase';
import type { User } from '@nyayamitra/shared';

// Typed collection reference
const usersRef = db.collection('users') as CollectionReference<User>;

// Get document
const userDoc = await usersRef.doc(userId).get();
if (!userDoc.exists) throw new NotFoundError('User');
const user = userDoc.data();

// Transaction for atomic updates
await db.runTransaction(async (tx) => {
  const userRef = usersRef.doc(userId);
  const user = (await tx.get(userRef)).data()!;
  tx.update(userRef, { 
    draftsUsedThisMonth: user.draftsUsedThisMonth + 1 
  });
});
```

### Storage Paths
```
templates/{templateId}.docx       # Template files (admin upload)
drafts/{userId}/{draftId}.docx    # Generated drafts (24h expiry)
```

## Mobile Patterns

### Navigation (Expo Router)
```typescript
import { router } from 'expo-router';

// Navigate
router.push('/category/civil');
router.push({ pathname: '/template/[id]', params: { id: '123' } });
router.replace('/login');
router.back();
```

### Screen Structure
```typescript
export function CategoryScreen() {
  const { data, isLoading, error, refetch } = useQuery(/* ... */);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} onRetry={refetch} />;
  if (!data?.length) return <EmptyState message="No templates" />;

  return <TemplateList data={data} />;
}
```

## Template System

### Variable Syntax (docxtemplater)
```
{{variable_name}}                 # Simple substitution
{#show_section}...{/show_section} # Conditional (truthy)
{#items}...{/items}               # Loop over array
```

### Variable Types
```typescript
type VariableType = 
  | 'STRING'      // Single line text
  | 'TEXT'        // Multi-line textarea
  | 'DATE'        // Date picker → DD/MM/YYYY
  | 'NUMBER'      // Numeric input
  | 'CURRENCY'    // ₹ prefix, Indian formatting
  | 'SELECT'      // Single select dropdown
  | 'MULTISELECT' // Multi-select checkboxes
  | 'PHONE'       // +91 XXXXXXXXXX
  | 'EMAIL';      // Email validation
```

### Formatting
```typescript
// Indian date
format(date, 'dd/MM/yyyy'); // 03/01/2026

// Indian currency
new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
}).format(100000); // ₹1,00,000

// Indian number
new Intl.NumberFormat('en-IN').format(10000000); // 1,00,00,000
```

## Security Rules

### Never Do
- Log secrets, tokens, or PII
- Store plaintext passwords
- Use `eval()` or `new Function()`
- Trust client-side data without validation
- Expose stack traces to clients
- Hardcode credentials

### Always Do
- Validate all inputs with Zod at API boundary
- Use parameterized queries (Firestore handles this)
- Sanitize user content before rendering
- Use HTTPS everywhere
- Set secure cookie flags
- Implement rate limiting

## Testing Requirements

### Unit Tests Required For
- All Zod validation schemas
- All service functions (business logic)
- All utility functions

### Integration Tests Required For
- All API route handlers
- Auth flows (mock Firebase)
- Draft generation end-to-end

### Test Structure
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('DraftService', () => {
  describe('generate', () => {
    it('generates draft with valid variables', async () => {
      // Arrange
      const template = createMockTemplate();
      const variables = { name: 'Test' };
      
      // Act
      const result = await generateDraft(template, variables);
      
      // Assert
      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('throws VALIDATION_ERROR for missing required variable', async () => {
      // ...
    });
  });
});
```

## Anti-Patterns — DO NOT USE

```typescript
// ❌ BAD: any type
function process(data: any) { }

// ✅ GOOD: explicit type
function process(data: CreateDraftRequest) { }

// ❌ BAD: console.log
console.log('Debug:', data);

// ✅ GOOD: structured logger
logger.info('Draft generated', { draftId, userId });

// ❌ BAD: default export
export default function Component() { }

// ✅ GOOD: named export
export function Component() { }

// ❌ BAD: nested ternary
const x = a ? b ? c : d : e;

// ✅ GOOD: early return
if (!a) return e;
if (!b) return d;
return c;

// ❌ BAD: magic number
if (user.drafts > 10) { }

// ✅ GOOD: named constant
import { DRAFT_LIMITS } from '@nyayamitra/shared';
if (user.drafts > DRAFT_LIMITS.free) { }

// ❌ BAD: useEffect for data fetching
useEffect(() => { fetchData(); }, []);

// ✅ GOOD: React Query
const { data } = useQuery({ queryKey: ['data'], queryFn: fetchData });
```

## Before Completing Any Task

### Checklist
- [ ] TypeScript compiles: `pnpm build`
- [ ] Linter passes: `pnpm lint`
- [ ] Tests pass: `pnpm test`
- [ ] No `any` types
- [ ] No `console.log`
- [ ] No default exports
- [ ] All functions have return types
- [ ] All API inputs validated with Zod
- [ ] Error responses use standard codes
- [ ] No hardcoded secrets or URLs

### Verification Commands
```bash
pnpm build && pnpm lint && pnpm test
```

## Environment Variables

### API (services/api/.env)
```
PORT=3000
NODE_ENV=development
FIREBASE_PROJECT_ID=nyayamitra-prod
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
TYPESENSE_HOST=xxx.typesense.net
TYPESENSE_API_KEY=xxx
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=xxx
```

### Mobile (apps/mobile/.env)
```
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_FIREBASE_API_KEY=xxx
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=nyayamitra-prod
```

### Web (apps/web/.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=nyayamitra-prod
```

## Git Workflow

```bash
# Branch naming
feature/task-0.1-init-monorepo
fix/auth-token-expiry
chore/update-deps

# Commit format
feat(api): add draft generation endpoint
fix(mobile): resolve OTP timer reset
chore(shared): update zod to v3.23
test(api): add drafts route tests

# Before push
pnpm build && pnpm lint && pnpm test
```

## Quick Reference

### Common Imports
```typescript
// Types
import type { User, Template, Draft, Category } from '@nyayamitra/shared';

// Validation
import { CreateDraftSchema, TemplateVariableSchema } from '@nyayamitra/shared';

// Constants
import { ERROR_CODES, DRAFT_LIMITS, VARIABLE_TYPES } from '@nyayamitra/shared';

// Firebase (API)
import { db, storage, auth } from '@/lib/firebase';

// Firebase (Client)
import { auth } from '@/services/firebase';
```

### Useful Commands
```bash
# Find files
find . -name "*.ts" -path "*/src/*" | head -20

# Search in files
grep -r "templateId" services/api/src/

# Check types
pnpm --filter @nyayamitra/shared build

# Run single test
pnpm --filter @nyayamitra/api test -- --grep "draft"
```

## Skills Available

Load a skill for focused work:
- `@frontend` - UI/UX, React, NativeWind, accessibility
- `@backend` - API, Supabase, security, data integrity
- `@security` - Vulnerability scanning, dependency audit
- `@pm` - GitHub issues, project board, sprint planning
- `@legal` - Template parsing, variable extraction, Indian legal formats
- `@devops` - CI/CD, Docker, deployment

### How to Use
1. Start task with skill prefix: "@frontend fix the login button styling"
2. Claude loads relevant context and constraints
3. Work stays focused within skill boundary

### Context Isolation Rules
- Frontend skill CANNOT modify API code
- Backend skill CANNOT modify components
- Each skill has explicit file scope
- Cross-cutting concerns require skill switch

---

## REMEMBER

This is a production application for real advocates handling legal documents. Every change must be:
- **Type-safe** — No runtime type errors
- **Validated** — All inputs checked
- **Tested** — Critical paths covered
- **Secure** — No data leaks
- **Observable** — Errors logged with context

Do not add features not in the current task. Do not skip validation. Do not use `any`. Ship production-ready code from day one.

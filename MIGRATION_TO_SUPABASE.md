# NyayaMitra Migration Guide: Firebase → Supabase

This document provides a comprehensive guide for migrating NyayaMitra from Firebase + Typesense to Supabase.

## Overview

### What's Changing

| Component | FROM | TO |
|-----------|------|-----|
| Authentication | Firebase Auth | Supabase Auth |
| Database | Firestore | Supabase Postgres |
| Storage | Cloud Storage | Supabase Storage |
| Search | Typesense Cloud | Postgres Full-Text Search |
| Client SDK | Firebase SDK | Supabase JS SDK |

### Why Supabase?

- ✅ **Single Platform**: Auth + Database + Storage + Realtime in one
- ✅ **PostgreSQL**: ACID compliant, powerful queries, full-text search built-in
- ✅ **Row Level Security**: Database-level security policies
- ✅ **Better DX**: Generated TypeScript types, instant APIs
- ✅ **Cost**: More predictable pricing than Firebase
- ✅ **India Region**: Mumbai data center available

## Prerequisites

Before starting:

- [ ] Backup all Firebase data (if migrating existing data)
- [ ] Have Supabase account ready
- [ ] Have database password saved securely
- [ ] Have API keys from Supabase project

## Migration Steps

### Phase 1: Supabase Project Setup (30 min)

#### 1.1 Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New project"
3. Fill in:
   - Name: `nyayamitra`
   - Database Password: (generate strong password - save it!)
   - Region: **Mumbai (ap-south-1)**
   - Plan: Pro (for production)

#### 1.2 Run Database Migrations

**Using Supabase Dashboard:**

1. Go to **SQL Editor**
2. Copy `supabase/migrations/20260104000000_initial_schema.sql`
3. Paste and click "Run"
4. Verify: Should see "Success. No rows returned"

**Verify migration:**
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Should show: `categories`, `drafts`, `profiles`, `subscriptions`, `templates`, `webhook_events`

#### 1.3 Create Storage Buckets

Go to **Storage** → Create buckets:

**Bucket 1: templates**
```
Name: templates
Public: No
File size limit: 10 MB
Allowed MIME types: application/vnd.openxmlformats-officedocument.wordprocessingml.document
```

**Bucket 2: drafts**
```
Name: drafts  
Public: No
File size limit: 10 MB
Allowed MIME types: application/vnd.openxmlformats-officedocument.wordprocessingml.document
```

After creating buckets, run storage policies:
1. Go to SQL Editor
2. Copy `supabase/migrations/20260104000001_storage_policies.sql`
3. Run

#### 1.4 Configure Authentication

**Enable Google OAuth:**
1. Go to **Authentication** → **Providers**
2. Click "Google"
3. Enable and add:
   - Client ID (from Google Cloud Console)
   - Client Secret
   - Redirect URL: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`

**Enable Phone/OTP:**
1. Click "Phone"  
2. Enable
3. Choose provider: Twilio (recommended) or Supabase
4. Add credentials

#### 1.5 Get Credentials

Go to **Settings** → **API** and note:

```env
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### Phase 2: Update Dependencies (15 min)

#### 2.1 API Service

```bash
cd services/api

# Remove Firebase
pnpm remove firebase-admin typesense

# Add Supabase
pnpm add @supabase/supabase-js

# Update .env
cat > .env << 'ENV'
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
ENV
```

#### 2.2 Web App

```bash
cd apps/web

# Remove Firebase
pnpm remove firebase

# Add Supabase
pnpm add @supabase/supabase-js @supabase/ssr

# Update .env.local
cat > .env.local << 'ENV'
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
NEXT_PUBLIC_API_URL=http://localhost:3000
ENV
```

#### 2.3 Mobile App

```bash
cd apps/mobile

# Remove Firebase
pnpm remove firebase

# Add Supabase
pnpm add @supabase/supabase-js

# Update .env
cat > .env << 'ENV'
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
EXPO_PUBLIC_API_URL=http://localhost:3000
ENV
```

#### 2.4 Shared Package

```bash
cd packages/shared

# Add Supabase (for types)
pnpm add -D supabase

# Generate types (after Supabase project is set up)
npx supabase gen types typescript --project-id YOUR_PROJECT_REF > src/types/database.types.ts
```

**Note:** For now, `database.types.ts` is already created with manual types. Regenerate after your Supabase project is live.

### Phase 3: Code Migration (See Implementation Files)

The detailed code changes are too extensive for this guide. Refer to these implementation files:

#### API Service Files to Create/Update:

1. `services/api/src/lib/supabase.ts` - Supabase client initialization
2. `services/api/src/middleware/auth.ts` - Update to use Supabase auth
3. `services/api/src/routes/categories.ts` - Use Supabase queries
4. `services/api/src/routes/templates.ts` - Use `search_templates()` function
5. `services/api/src/routes/drafts.ts` - Storage and database operations
6. `services/api/src/lib/env.ts` - Update environment variables

#### Web App Files to Create/Update:

1. `apps/web/src/lib/supabase.ts` - Browser Supabase client
2. `apps/web/src/contexts/AuthContext.tsx` - Supabase auth hooks
3. `apps/web/src/app/auth/callback/route.ts` - OAuth callback handler
4. `apps/web/src/lib/api.ts` - API client with Supabase tokens

#### Mobile App Files to Create/Update:

1. `apps/mobile/services/supabase.ts` - React Native Supabase client
2. `apps/mobile/contexts/AuthContext.tsx` - Supabase auth for mobile
3. `apps/mobile/services/api.ts` - API client

**Full implementation details**: See the original task description sections "PHASE 3: UPDATE API SERVICE" and "PHASE 4: UPDATE WEB APP" for complete code.

### Phase 4: Import Templates (45 min for 3,289 templates)

#### 4.1 Setup Import Script

```bash
cd scripts

# Update .env
cat > .env << 'ENV'
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
ENV

# Install Supabase if not already
pnpm add @supabase/supabase-js
```

#### 4.2 Run Import

**Dry run first (recommended):**
```bash
# This would be implemented if needed
DRY_RUN=true pnpm import:templates-supabase
```

**Full import:**
```bash
pnpm import:templates-supabase
```

Expected output:
```
Starting Supabase template import...
Found 3289 .docx files
Pending: 3289

Batch 1/66
Created category: Gift
  ✓ 10 templates imported
...

========== IMPORT COMPLETE ==========
Success: 3289
Errors: 0
Categories: 62
```

**Verify in Supabase:**
```sql
SELECT COUNT(*) FROM templates;  -- Should be 3289
SELECT COUNT(*) FROM categories;  -- Should be ~60-80
SELECT name, template_count FROM categories ORDER BY template_count DESC LIMIT 10;
```

### Phase 5: Testing (1-2 hours)

#### 5.1 API Tests

```bash
cd services/api

# Update test setup to use Supabase
# Create test Supabase project or use local Supabase

pnpm test
```

#### 5.2 Web App Tests

```bash
cd apps/web

# Start dev server
pnpm dev

# Test flows:
# 1. Sign up with Google
# 2. Sign in with Phone OTP
# 3. Browse categories
# 4. Search templates
# 5. Generate draft
# 6. Download draft
```

#### 5.3 Mobile App Tests

```bash
cd apps/mobile

# Start on iOS
pnpm ios

# Test same flows as web
```

### Phase 6: Deployment

#### 6.1 Deploy API

```bash
cd services/api

# Build
pnpm build

# Deploy to Cloud Run
gcloud run deploy nyayamitra-api \
  --source . \
  --region asia-south1 \
  --set-env-vars SUPABASE_URL=https://xxx.supabase.co,SUPABASE_SERVICE_ROLE_KEY=xxx
```

#### 6.2 Deploy Web

```bash
cd apps/web

# Build
pnpm build

# Deploy to Vercel
vercel --prod

# Set environment variables in Vercel dashboard
```

#### 6.3 Deploy Mobile

```bash
cd apps/mobile

# iOS
eas build --platform ios

# Android
eas build --platform android
```

## Post-Migration Checklist

- [ ] All API endpoints working with Supabase
- [ ] Authentication (Google + Phone) working
- [ ] Template search returning correct results
- [ ] Draft generation and download working
- [ ] Subscriptions being created in database
- [ ] Storage buckets configured correctly
- [ ] RLS policies tested and working
- [ ] Environment variables set in production
- [ ] Monitoring and logging set up
- [ ] Backup strategy in place

## Rollback Plan

If migration fails:

1. **Revert code changes:**
   ```bash
   git revert <migration-commit>
   ```

2. **Switch back environment variables** to Firebase

3. **Redeploy** previous version

4. **DNS/Traffic**: Point back to Firebase-based deployment

## Key Differences from Firebase

### Authentication

**Firebase:**
```typescript
const user = await auth().currentUser;
const token = await user.getIdToken();
```

**Supabase:**
```typescript
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
```

### Database

**Firebase (Firestore):**
```typescript
const snapshot = await db.collection('templates').where('isActive', '==', true).get();
const templates = snapshot.docs.map(doc => doc.data());
```

**Supabase (Postgres):**
```typescript
const { data: templates } = await supabase
  .from('templates')
  .select('*')
  .eq('is_active', true);
```

### Storage

**Firebase:**
```typescript
const url = await bucket.file('templates/xxx.docx').getSignedUrl({
  action: 'read',
  expires: Date.now() + 86400000,
});
```

**Supabase:**
```typescript
const { data: { signedUrl } } = await supabase.storage
  .from('templates')
  .createSignedUrl('xxx.docx', 86400);
```

### Search

**Typesense:**
```typescript
const results = await typesense
  .collections('templates')
  .documents()
  .search({ q: 'deed of gift', query_by: 'name,description' });
```

**Supabase (Postgres FTS):**
```typescript
const { data: results } = await supabase
  .rpc('search_templates', {
    search_query: 'deed of gift',
    page_num: 1,
    page_size: 20,
  });
```

## Troubleshooting

### "Invalid API key"
- Check SUPABASE_SERVICE_ROLE_KEY is set correctly
- Verify not using ANON_KEY for server-side operations

### "permission denied for table profiles"
- RLS policies not applied
- Check auth token is being sent
- Verify policies in Supabase Dashboard → Authentication → Policies

### Storage upload fails
- Bucket doesn't exist - create in Dashboard
- Storage policies not applied - run migration
- File too large - check 10MB limit

### Full-text search returns no results
- Search vector not generated - check migration ran successfully
- Try simple search: `name ILIKE '%search%'` to debug
- Reindex: `REINDEX INDEX templates_search_idx;`

## Performance Optimization

### Database Indexes

Already created in migration, but monitor:

```sql
-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan 
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

### Connection Pooling

Supabase includes connection pooling by default (Supavisor).

For API service, use:
```
SUPABASE_URL=https://xxx.supabase.co  (Transaction mode)
```

Or for better performance with serverless:
```
SUPABASE_URL=https://xxx.pooler.supabase.com  (Session mode)
```

### Storage CDN

Supabase Storage uses CloudFlare CDN automatically for public files.

## Cost Estimates

### Supabase Pro Plan
- **Base**: $25/month
- **Database**: 8GB included, $0.125/GB after
- **Storage**: 100GB included, $0.021/GB after
- **Bandwidth**: 250GB included, $0.09/GB after

### Estimated for NyayaMitra

- Templates: ~500MB storage
- Drafts: ~1-2GB/month (with 24h expiry + cleanup)
- Database: ~2-3GB
- Bandwidth: ~100GB/month

**Total**: ~$25-40/month (vs Firebase ~$100-150/month)

## Support

- **Supabase Docs**: https://supabase.com/docs
- **Supabase Discord**: https://discord.supabase.com  
- **Postgres Docs**: https://www.postgresql.org/docs/

## Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Supabase Setup | 30 min | ⏳ Pending |
| Update Dependencies | 15 min | ⏳ Pending |
| Code Migration | 3-4 hours | ⏳ Pending |
| Import Templates | 45 min | ⏳ Pending |
| Testing | 1-2 hours | ⏳ Pending |
| Deployment | 30 min | ⏳ Pending |
| **Total** | **6-8 hours** | - |

---

**Last Updated**: 2026-01-04  
**Migration Status**: Ready to Execute  
**Next Step**: Create Supabase project and run Phase 1

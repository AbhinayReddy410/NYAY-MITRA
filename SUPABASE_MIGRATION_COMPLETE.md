# Supabase Migration - Completion Guide

## ✅ COMPLETED SETUP

### 1. Environment Files Created
- ✅ `services/api/.env` - API environment variables
- ✅ `apps/web/.env.local` - Web client environment variables
- ✅ `scripts/.env` - Import script environment variables
- ✅ `.gitignore` updated to exclude `.env` files

### 2. Database Schema Ready
- ✅ Created `supabase/migrations/001_initial_schema.sql`
- Includes:
  - Tables: profiles, categories, templates, drafts, subscriptions, webhook_events
  - RLS (Row Level Security) policies
  - Full-text search indexes
  - Auto-profile creation trigger
  - Helper functions for category/template counts

### 3. API Updated for Supabase
- ✅ Created `services/api/src/lib/supabase.ts` - Supabase client
- ✅ Updated `services/api/src/middleware/auth.ts` - Supabase auth
- ✅ Updated `services/api/src/routes/categories.ts` - Supabase queries
- ✅ Updated `services/api/src/routes/templates.ts` - Supabase with full-text search
- ✅ Added `@supabase/supabase-js` dependency

### 4. Template Import Script Ready
- ✅ Exists at `scripts/import-supabase.ts`
- Features:
  - Parses {var} and [VAR] patterns from .docx files
  - Auto-creates categories from folder structure
  - Uploads to Supabase Storage
  - Creates Postgres records
  - Resumable with progress tracking
  - Batch processing (10 files at a time)

---

## ⚠️ MANUAL STEPS REQUIRED

### Step 1: Apply Database Schema

**Option A: Via Supabase Dashboard (Recommended)**
1. Go to: https://supabase.com/dashboard/project/bdarigaxzjdmjepbzhws
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy entire contents of `supabase/migrations/001_initial_schema.sql`
5. Paste and click **Run**
6. Verify no errors in output

**Option B: Via Supabase CLI** (if installed)
```bash
supabase db push
```

**Verification:**
Run this query in SQL Editor:
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Expected tables:
- categories
- drafts
- profiles
- subscriptions
- templates
- webhook_events

### Step 2: Create Storage Buckets

**In Supabase Dashboard:**

1. Go to **Storage** → **Create a new bucket**

**Bucket 1: templates**
- Name: `templates`
- Public: ✅ (checked)
- File size limit: 10 MB
- Allowed MIME types: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

**Bucket 2: drafts**
- Name: `drafts`
- Public: ❌ (unchecked - private)
- File size limit: 10 MB
- Allowed MIME types: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

**Verification:**
Check Storage page shows both buckets.

### Step 3: Run Template Import

**IMPORTANT:** Only run after completing Steps 1 & 2 above!

```bash
cd scripts
pnpm install  # if not already done
pnpm run import:supabase
```

**Expected Output:**
```
========================================
NyayaMitra Supabase Template Import
========================================

Initializing Supabase client...

Scanning source folders...
Found 3289 .docx files
3289 files pending import
0 files already imported
0 categories created

Starting import...

--- Batch 1/329 ---
  ✓ Created category: Civil Law
  ✓ Rent Agreement (12 vars)
  ✓ Sale Deed (18 vars)
  ...
```

**Duration:** Approximately 30-45 minutes for 3289 files

**Progress Tracking:**
- Progress saved to `scripts/import-progress-supabase.json`
- Errors logged to `scripts/import-errors-supabase.json`
- Script is resumable - just run again if interrupted

**Verification After Import:**
```bash
# Check categories count
curl -s "https://bdarigaxzjdmjepbzhws.supabase.co/rest/v1/categories?select=name&limit=10" \
  -H "apikey: ${SUPABASE_ANON_KEY}"

# Check templates count
curl -s "https://bdarigaxzjdmjepbzhws.supabase.co/rest/v1/templates?select=count" \
  -H "apikey: ${SUPABASE_ANON_KEY}"
```

### Step 4: Test API Locally

```bash
# Terminal 1: Start API
cd services/api
pnpm dev

# Terminal 2: Test endpoints
curl http://localhost:3000/health
# Expected: {"status":"ok","timestamp":"2026-01-05T..."}
```

**Note:** Categories and templates endpoints require authentication token.

### Step 5: Update Remaining Routes (Optional for MVP)

These routes still need Supabase migration (currently commented out or using Firebase):
- `services/api/src/routes/drafts.ts` - Draft generation
- `services/api/src/routes/user.ts` - User profile
- `services/api/src/routes/payments.ts` - Razorpay integration

Will update in subsequent phases.

---

## 🔐 SECURITY - POST-MIGRATION

### CRITICAL: Rotate Service Role Key

The `SUPABASE_SERVICE_ROLE_KEY` has been exposed in this conversation.

**Steps to rotate:**
1. Go to Supabase Dashboard → Settings → API
2. Click "Generate new service_role secret"
3. Copy the new key
4. Update in ALL `.env` files:
   - `services/api/.env`
   - `scripts/.env`
5. Restart API and re-run any scripts

### Verify .gitignore

```bash
git status
```

Ensure NO `.env` files appear in git status output.

---

## 📊 MIGRATION SUMMARY

| Component | Status | Notes |
|-----------|--------|-------|
| Database Schema | ✅ Ready | Apply manually via Dashboard |
| Storage Buckets | ⏳ Manual | Create templates & drafts buckets |
| API - Categories | ✅ Complete | Supabase queries |
| API - Templates | ✅ Complete | Full-text search enabled |
| API - Auth | ✅ Complete | Supabase Auth middleware |
| Template Import | ✅ Ready | Run after schema + buckets |
| API - Drafts | ⏳ TODO | Next phase |
| API - User | ⏳ TODO | Next phase |
| API - Payments | ⏳ TODO | Next phase |
| Web Client | ⏳ TODO | Update to Supabase Auth SDK |
| Mobile Client | ⏳ TODO | Update to Supabase Auth SDK |

---

## 🚀 NEXT STEPS AFTER IMPORT

1. **Update Web Client** - Replace Firebase Auth with Supabase Auth
2. **Update Mobile Client** - Replace Firebase Auth with Supabase Auth
3. **Implement Draft Generation** - Update `routes/drafts.ts` for Supabase Storage
4. **Implement User Profile** - Update `routes/user.ts`
5. **Setup Razorpay** - Configure payment integration
6. **Deploy API** - Deploy to Fly.io/Railway/Cloud Run
7. **Setup CI/CD** - GitHub Actions for automated testing and deployment

---

## 📝 FILES MODIFIED

```
.gitignore                                  # Added .env patterns
apps/web/.env.local                         # Replaced Firebase with Supabase
services/api/.env                           # NEW - Supabase credentials
services/api/package.json                   # Added @supabase/supabase-js
services/api/src/lib/supabase.ts            # NEW - Supabase client
services/api/src/middleware/auth.ts         # Updated for Supabase Auth
services/api/src/routes/categories.ts       # Updated for Supabase queries
services/api/src/routes/templates.ts        # Updated for Supabase + FTS
scripts/.env                                # NEW - Supabase credentials
scripts/import-supabase.ts                  # NEW - Import script
supabase/migrations/001_initial_schema.sql  # NEW - Database schema
MIGRATION_INSTRUCTIONS.md                   # NEW - Manual steps guide
SUPABASE_MIGRATION_COMPLETE.md              # NEW - This file
```

---

## ⚡ QUICK START CHECKLIST

- [ ] Apply database schema in Supabase Dashboard (Step 1)
- [ ] Create `templates` bucket (public) (Step 2)
- [ ] Create `drafts` bucket (private) (Step 2)
- [ ] Run `cd scripts && pnpm run import:supabase` (Step 3)
- [ ] Wait ~30-45 minutes for import to complete
- [ ] Verify categories and templates in Supabase Dashboard
- [ ] Test API with `cd services/api && pnpm dev`
- [ ] Rotate SUPABASE_SERVICE_ROLE_KEY (Security step)
- [ ] Commit changes and push to GitHub

---

## 📞 SUPPORT

If you encounter issues:

1. Check `scripts/import-errors-supabase.json` for failed imports
2. Verify Supabase credentials in `.env` files
3. Check Supabase Dashboard → Logs for database errors
4. Verify Storage buckets exist and have correct permissions

**Common Issues:**

- **"relation does not exist"** → Schema not applied (Step 1)
- **"The resource already exists"** → Bucket already created (continue)
- **"Failed to upload"** → Check Storage bucket permissions
- **"Invalid API key"** → Check SUPABASE_SERVICE_ROLE_KEY in scripts/.env

---

**Migration prepared by:** Claude Code
**Date:** 2026-01-05
**Project:** NyayaMitra - Legal Draft Generation Platform

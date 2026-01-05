# Supabase Setup for NyayaMitra

This directory contains database migrations and configuration for NyayaMitra's Supabase backend.

## Initial Setup

### 1. Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New project"
3. Fill in details:
   - **Name**: nyayamitra
   - **Database Password**: (generate a strong password - save it!)
   - **Region**: Mumbai (ap-south-1) - closest to Indian users
   - **Pricing Plan**: Pro (recommended for production)

4. Wait for project creation (~2 minutes)

### 2. Note Down Credentials

After project creation, go to **Settings** → **API**:

```env
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...  (starts with eyJ)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  (starts with eyJ, different from anon key)
```

### 3. Run Database Migrations

**Option A: Using Supabase Dashboard (Recommended for first time)**

1. Go to **SQL Editor** in Supabase Dashboard
2. Click "New query"
3. Copy contents of `migrations/20260104000000_initial_schema.sql`
4. Paste and click "Run"
5. Repeat for `migrations/20260104000001_storage_policies.sql`

**Option B: Using Supabase CLI**

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref YOUR_PROJECT_REF

# Run migrations
supabase db push
```

### 4. Create Storage Buckets

Go to **Storage** in Supabase Dashboard:

#### Bucket 1: templates
- Name: `templates`
- Public: ❌ No (private)
- File size limit: 10 MB
- Allowed MIME types: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

#### Bucket 2: drafts  
- Name: `drafts`
- Public: ❌ No (private)
- File size limit: 10 MB
- Allowed MIME types: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

### 5. Configure Authentication

Go to **Authentication** → **Providers**:

#### Enable Google OAuth
1. Click "Google"
2. Enable
3. Add OAuth credentials:
   - Client ID: (from Google Cloud Console)
   - Client Secret: (from Google Cloud Console)
   - Authorized redirect URLs: Add `https://xxxxx.supabase.co/auth/v1/callback`

#### Enable Phone (OTP)
1. Click "Phone"
2. Enable
3. Choose provider:
   - **Twilio** (recommended for India)
   - Or use Supabase's built-in provider (limited free tier)
4. Add Twilio credentials if using Twilio

### 6. Verify Setup

Run these SQL queries in SQL Editor to verify:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Should show: categories, drafts, profiles, subscriptions, templates, webhook_events

-- Check indexes
SELECT indexname FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY indexname;

-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public';

-- All tables should have rowsecurity = true

-- Check storage buckets
SELECT * FROM storage.buckets;

-- Should show: templates, drafts
```

## Environment Variables

### API Service (services/api/.env)
```env
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

### Web App (apps/web/.env.local)
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
NEXT_PUBLIC_API_URL=https://api.nyayamitra.com
```

### Mobile App (apps/mobile/.env)
```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
EXPO_PUBLIC_API_URL=https://api.nyayamitra.com
```

### Scripts (scripts/.env)
```env
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

## Database Schema

### Tables

- **profiles**: User profiles (extends auth.users)
- **categories**: Template categories
- **templates**: Legal document templates with full-text search
- **drafts**: User-generated drafts (24h expiry)
- **subscriptions**: Razorpay subscription records
- **webhook_events**: Webhook deduplication

### Key Features

1. **Full-Text Search**: Templates use PostgreSQL's `tsvector` for fast, relevant search
2. **Row Level Security (RLS)**: All tables have policies ensuring users can only access their own data
3. **Auto-timestamping**: `updated_at` automatically updated on every row change
4. **Auto-profile creation**: Profile created automatically when user signs up
5. **Helper functions**: `search_templates()`, `increment_category_count()`, etc.

## Useful SQL Queries

### Get all templates in a category
```sql
SELECT * FROM templates 
WHERE category_id = 'cat-gift' 
AND is_active = true 
ORDER BY usage_count DESC;
```

### Search templates
```sql
SELECT * FROM search_templates(
  search_query := 'deed of gift',
  category_filter := NULL,
  page_num := 1,
  page_size := 20
);
```

### Get user's draft history
```sql
SELECT * FROM drafts 
WHERE user_id = 'user-uuid-here' 
ORDER BY created_at DESC 
LIMIT 20;
```

### Check monthly usage
```sql
SELECT 
  email,
  plan,
  drafts_used_this_month,
  drafts_reset_date
FROM profiles
ORDER BY drafts_used_this_month DESC;
```

## Maintenance

### Clean up expired drafts (run daily)
```sql
DELETE FROM drafts WHERE expires_at < NOW();
```

You can set this up as a Supabase Edge Function or cron job.

### Reset monthly draft counts (run on 1st of month)
```sql
UPDATE profiles 
SET 
  drafts_used_this_month = 0,
  drafts_reset_date = DATE_TRUNC('month', CURRENT_DATE)
WHERE drafts_reset_date < DATE_TRUNC('month', CURRENT_DATE);
```

## Troubleshooting

### "permission denied for table profiles"
- Check RLS policies are created
- Verify you're using correct auth token
- For service operations, use service_role key

### "relation storage.objects does not exist"
- Storage buckets not created yet
- Create buckets in Dashboard first, then run storage policies migration

### Full-text search not working
- Check `search_vector` column exists on templates table
- Verify GIN index on search_vector
- Try refreshing with: `REINDEX INDEX templates_search_idx;`

### Storage upload fails
- Check bucket exists
- Verify bucket policies are applied
- Check file size < 10MB
- Verify MIME type is allowed

## Support

For Supabase-specific issues, see:
- https://supabase.com/docs
- https://github.com/supabase/supabase/discussions

For NyayaMitra-specific issues, check the main README.md

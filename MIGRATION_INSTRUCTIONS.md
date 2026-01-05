# Supabase Migration Instructions

## Apply Database Schema

1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/bdarigaxzjdmjepbzhws
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the contents of `supabase/migrations/001_initial_schema.sql`
5. Paste into the SQL editor
6. Click **Run** to execute

The schema creates:
- Tables: profiles, categories, templates, drafts, subscriptions, webhook_events
- Indexes for performance
- RLS policies for security
- Triggers for auto-profile creation
- Helper functions

## Create Storage Buckets

1. In Supabase Dashboard, go to **Storage**
2. Click **Create a new bucket**

### Bucket 1: templates
- Name: `templates`
- Public: ✓ (checked)
- File size limit: 10 MB
- Allowed MIME types: application/vnd.openxmlformats-officedocument.wordprocessingml.document

### Bucket 2: drafts
- Name: `drafts`
- Public: ✗ (unchecked)
- File size limit: 10 MB
- Allowed MIME types: application/vnd.openxmlformats-officedocument.wordprocessingml.document

## Verify Setup

Run this query in SQL Editor to check tables:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Expected output:
- categories
- drafts
- profiles
- subscriptions
- templates
- webhook_events

## Next Steps

After completing the above:
1. Run the template import script: `cd scripts && pnpm import`
2. Start the API: `cd services/api && pnpm dev`
3. Verify the API health: `curl http://localhost:3000/health`

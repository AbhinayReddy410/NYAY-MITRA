# Quick Start Guide - Template Import

## Prerequisites Check

Run this to verify everything is ready:

```bash
# 1. Verify source folders exist
ls -la "/Users/aabhinay/Desktop/English Legal draft" | head -5
ls -la "/Users/aabhinay/Desktop/3500+ Legal Drafts" | head -5

# 2. Count files
node -e "
const fs = require('fs');
const path = require('path');
function count(dir) {
  let n = 0;
  const walk = (d) => {
    fs.readdirSync(d, { withFileTypes: true }).forEach(f => {
      const p = path.join(d, f.name);
      if (f.isDirectory()) walk(p);
      else if (f.name.endsWith('.docx') && !f.name.startsWith('~$')) n++;
    });
  };
  try { walk(dir); } catch(e) {}
  return n;
}
console.log('English Legal draft:', count('/Users/aabhinay/Desktop/English Legal draft'));
console.log('3500+ Legal Drafts:', count('/Users/aabhinay/Desktop/3500+ Legal Drafts'));
"
```

## Step 1: Install Dependencies

```bash
cd scripts
pnpm install
```

## Step 2: Configure Environment

```bash
cd scripts
cp .env.example .env
```

Edit `.env` and add your credentials:

```env
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...your full service account JSON...}'
FIREBASE_STORAGE_BUCKET=nyayamitra-prod.appspot.com
TYPESENSE_HOST=xxx.a1.typesense.net
TYPESENSE_API_KEY=xxx
```

## Step 3: Test with Dry Run

```bash
cd scripts
pnpm import:dry-run
```

Expected output:
```
========================================
NyayaMitra Template Import System
========================================

🔍 DRY RUN MODE - No changes will be made

Initializing services...

Scanning source folders...
Found 3289 .docx files
3289 files pending import
0 files already imported

Starting import...

--- Batch 1/329 ---
  ✓ DEED OF GIFT BY A FATHER TO HIS SON (0 vars)
  ✓ CHILD CUSTODY AGREEMENT (2 vars)
  ...
```

## Step 4: Run Full Import

Once dry run looks good:

```bash
cd scripts
pnpm import:templates
```

This will:
- Process all 3,289 files
- Upload to Cloud Storage
- Create Firestore documents
- Index to Typesense
- Take ~30-45 minutes

## Step 5: Monitor Progress

While running, you can check:

```bash
# Watch progress file
watch -n 5 'cat scripts/import-progress.json | jq ".totalProcessed"'

# Check errors
cat scripts/import-errors.json | jq '.'
```

## Step 6: Verify Import

After completion:

```bash
# Check Firestore (using Firebase CLI)
firebase firestore:indexes

# Check Storage
gsutil ls gs://nyayamitra-prod.appspot.com/templates/ | wc -l

# Check Typesense (using curl)
curl -H "X-TYPESENSE-API-KEY: $TYPESENSE_API_KEY" \
  "https://$TYPESENSE_HOST/collections/templates"
```

## Troubleshooting

### Import stuck?
Check last batch in progress file:
```bash
cat scripts/import-progress.json | jq '.totalProcessed'
```

### Need to restart?
Just run again - it will resume:
```bash
cd scripts
pnpm import:resume
```

### Want to reset completely?
```bash
cd scripts
rm import-progress.json import-errors.json
pnpm import:templates
```

## Production Checklist

Before running in production:

- [ ] Backup existing Firestore data
- [ ] Run dry run successfully
- [ ] Verify Firebase credentials
- [ ] Check Storage bucket exists
- [ ] Confirm Typesense is accessible
- [ ] Monitor first 10-20 imports
- [ ] Verify templates are searchable

## Support

For detailed documentation, see:
- `IMPORT_README.md` - Full documentation
- `scripts/import-templates.ts` - Source code with comments

---

Ready to import 3,289 legal templates! 🚀

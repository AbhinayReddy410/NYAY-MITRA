# NyayaMitra Template Import System

Production-grade system for importing 3500+ legal document templates into NyayaMitra.

## Overview

This script automatically:
- ✅ Scans 3,289 .docx files from source folders
- ✅ Auto-detects categories from folder structure
- ✅ Parses variables in {var} and [VAR] formats
- ✅ Infers variable types (STRING, DATE, CURRENCY, PHONE, EMAIL, TEXT, NUMBER)
- ✅ Uploads templates to Cloud Storage
- ✅ Creates Firestore documents
- ✅ Indexes to Typesense for search
- ✅ Updates category counts
- ✅ Tracks progress (resumable on failure)
- ✅ Logs errors for debugging

## Setup

### 1. Install Dependencies

```bash
cd scripts
pnpm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required variables:
- `FIREBASE_SERVICE_ACCOUNT`: Firebase service account JSON (entire object as string)
- `FIREBASE_STORAGE_BUCKET`: Storage bucket name (e.g., `nyayamitra-prod.appspot.com`)
- `TYPESENSE_HOST`: Typesense cloud host
- `TYPESENSE_API_KEY`: Typesense API key
- `DRY_RUN`: Set to `true` for testing without making changes

### 3. Verify Source Folders

Ensure these folders exist and contain .docx files:
- `/Users/aabhinay/Desktop/English Legal draft` (3,124 files)
- `/Users/aabhinay/Desktop/3500+ Legal Drafts` (165 files)

## Usage

### Dry Run (Test Mode)

Test the import without making any changes:

```bash
cd scripts
DRY_RUN=true pnpm import:templates
```

This will:
- Scan all files
- Parse variables
- Show what would be imported
- NOT upload or create documents

### Full Import

Import all templates:

```bash
cd scripts
pnpm import:templates
```

### Resume Import

If the import fails or is interrupted, simply run again - it will automatically resume from where it left off:

```bash
cd scripts
pnpm import:templates
```

Progress is saved to `import-progress.json` after each batch.

## How It Works

### 1. File Discovery

Recursively scans source folders for `.docx` files:
- Skips temporary files (`~$*.docx`)
- Discovers 3,289 total files

### 2. Category Detection

Automatically creates categories from folder structure:

```
3500+ Legal Drafts/
  ├── Gift/              → Category: "Gift"
  ├── Child Custody/     → Category: "Child Custody"
  └── Arbitration/       → Category: "Arbitration"
```

### 3. Variable Parsing

Supports multiple variable patterns:
- `{variable_name}` (curly braces)
- `[VARIABLE_NAME]` (square brackets)

Example:
```
Input: {Name}, {Date of Birth}, [AMOUNT]
Output:
  - name: "Name", type: "STRING"
  - name: "Date of Birth", type: "DATE"
  - name: "AMOUNT", type: "CURRENCY"
```

### 4. Type Inference

Automatically infers variable types:

| Pattern | Type | Example |
|---------|------|---------|
| Contains "date", "on", "at" | DATE | {agreement_date}, [DATE OF BIRTH] |
| Contains "amount", "price", "rent" | CURRENCY | {rent_amount}, [PRICE] |
| Contains "phone", "mobile" | PHONE | {contact_number} |
| Contains "email" | EMAIL | {email_address} |
| Contains "address", "description" | TEXT | {full_address} |
| Contains "number", "count", "age" | NUMBER | {age}, {quantity} |
| Default | STRING | {name}, {title} |

### 5. Upload & Index

For each template:
1. Upload `.docx` to Cloud Storage (`templates/{template_id}.docx`)
2. Create Firestore document in `templates` collection
3. Index to Typesense for search
4. Update category `templateCount`

### 6. Progress Tracking

Creates `import-progress.json`:

```json
{
  "imported": ["/path/to/file1.docx", "/path/to/file2.docx"],
  "failed": [{"file": "/path/to/file3.docx", "error": "..."}],
  "lastUpdated": "2026-01-04T23:30:00.000Z",
  "totalProcessed": 150
}
```

## Output

### Success

```
========================================
IMPORT COMPLETE
========================================
Total files found: 3289
Successfully imported: 3150
Failed: 5
Categories created: 62
Duration: 1847.3s
Progress saved to: ./import-progress.json
```

### Errors

Errors are logged to `import-errors.json`:

```json
[
  {
    "file": "/path/to/corrupted.docx",
    "error": "Invalid file format"
  }
]
```

## Configuration

Edit `scripts/import-templates.ts` to customize:

```typescript
const CONFIG = {
  sourceFolders: [...],  // Source directories
  batchSize: 10,         // Files per batch (saves progress after each batch)
  dryRun: false,         // Test mode
};
```

## Troubleshooting

### "Source folder not found"
Verify the source folder paths in the script match your system.

### "Firebase not initialized"
Ensure `FIREBASE_SERVICE_ACCOUNT` is valid JSON and `FIREBASE_STORAGE_BUCKET` is correct.

### "Typesense connection failed"
Check `TYPESENSE_HOST` and `TYPESENSE_API_KEY` are correct.

### "No variables found"
70% of templates are static (no variables) - this is expected.

### Import interrupted
Simply run `pnpm import:templates` again - it will resume automatically.

## Performance

- **Batch size**: 10 files (adjustable)
- **Progress saves**: After each batch
- **Estimated time**: ~30-45 minutes for 3,289 files
- **Storage**: ~500MB for all templates
- **Firestore writes**: ~3,289 documents
- **Typesense indexes**: ~3,289 records

## Production Checklist

Before running in production:

- [ ] Backup existing Firestore data
- [ ] Run dry run first: `DRY_RUN=true pnpm import:templates`
- [ ] Verify Firebase credentials have write access
- [ ] Ensure Storage bucket exists
- [ ] Confirm Typesense collection doesn't exist (will be created)
- [ ] Check sufficient Storage quota (~500MB)
- [ ] Monitor first batch import
- [ ] Verify templates are searchable

## Support

For issues, check:
1. `import-progress.json` for current state
2. `import-errors.json` for error details
3. Console output for real-time progress

---

Built with ❤️ for NyayaMitra

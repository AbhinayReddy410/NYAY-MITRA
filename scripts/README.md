# NyayaMitra Scripts

CLI scripts for administrative tasks.

## Template Import Script

Import legal document templates in bulk from a folder with metadata.

### Setup

1. Install dependencies:
   ```bash
   cd scripts
   pnpm install
   ```

2. Set environment variables:
   ```bash
   export FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/serviceAccount.json
   export TYPESENSE_HOST=xxx.a1.typesense.net
   export TYPESENSE_API_KEY=your_api_key
   ```

### Prepare Templates

1. Create `templates/` folder with `.docx` files:
   ```
   scripts/
   ├── templates/
   │   ├── sale_deed.docx
   │   ├── rental_agreement.docx
   │   └── divorce_petition.docx
   └── metadata.csv
   ```

2. Create `metadata.csv` with template information:
   ```csv
   filename,name,description,categoryId,estimatedMinutes
   sale_deed.docx,Sale Deed,Property sale agreement,civil_001,30
   rental_agreement.docx,Rental Agreement,Residential rental,civil_001,20
   ```

   **Columns**:
   - `filename`: Name of .docx file in templates/ folder
   - `name`: Display name for template
   - `description`: Brief description
   - `categoryId`: Firestore category document ID
   - `estimatedMinutes`: Estimated time to fill template

### Template Format

Templates must use docxtemplater variable syntax:

```
This agreement is made on {{date}} between {{party_a_name}}
(Party A) and {{party_b_name}} (Party B).

Party A Address: {{party_a_address}}
Party B Address: {{party_b_address}}

Amount: {{amount}}
```

**Variable naming**:
- Use `snake_case` for variable names
- Keep names descriptive but concise
- Script auto-generates labels (e.g., `party_a_name` → "Party A Name")

### Usage

**Import all templates**:
```bash
npx tsx import-templates.ts
```

**Import with batch size**:
```bash
npx tsx import-templates.ts --batch 50
```

**Resume interrupted import**:
```bash
npx tsx import-templates.ts --resume
```

**Custom batch with resume**:
```bash
npx tsx import-templates.ts --batch 100 --resume
```

### What It Does

For each template in `metadata.csv`:

1. **Read .docx file** from `templates/` folder
2. **Parse variables** using PizZip (finds `{{variable}}` patterns)
3. **Validate template** structure
4. **Upload to Storage** at `templates/{templateId}.docx`
5. **Create Firestore document** with:
   - Template metadata
   - Parsed variables with auto-generated labels
   - Active status
   - Timestamps
6. **Index to Typesense** for search
7. **Update category count** in Firestore

### Progress Tracking

The script creates:

**progress.json**:
```json
{
  "imported": ["sale_deed.docx", "rental_agreement.docx"],
  "failed": [],
  "lastProcessed": "rental_agreement.docx",
  "totalProcessed": 2
}
```

**errors.json** (if errors occur):
```json
[
  {
    "filename": "invalid_template.docx",
    "error": "Template file not found",
    "timestamp": "2026-01-04T12:00:00.000Z"
  }
]
```

### Resume Capability

If import is interrupted:

1. Script saves progress after every 100 templates
2. Run with `--resume` to continue from last checkpoint
3. Skips already imported templates
4. Retries failed templates can be handled manually

### Output

**Success**:
```
🚀 NyayaMitra Template Import
==============================

⚙️  Initializing...

✅ Firebase initialized
✅ Typesense initialized

📊 Total templates: 10
📋 To process: 10
✅ Already imported: 0
❌ Previously failed: 0

📝 Processing: Sale Deed (sale_deed.docx)
📝 Processing: Rental Agreement (rental_agreement.docx)
...
✅ Progress: 100/250 templates imported
...

📊 Updating category counts...
✅ Updated category: civil_001
✅ Updated category: family_001

✅ Import complete!
==================
Total processed: 10
Successfully imported: 10
Failed: 0
```

**Partial Success**:
```
✅ Import complete!
==================
Total processed: 8
Successfully imported: 7
Failed: 1

See errors.json for error details
```

**Interrupted**:
```
⏸️  Batch limit reached (100). Saving progress...

⚠️  Not all templates processed. Run with --resume to continue.
```

### Error Handling

Common errors and solutions:

**Template file not found**:
```
❌ Failed: sale_deed.docx - Template file not found: templates/sale_deed.docx
```
Solution: Ensure file exists in `templates/` folder

**Category not found**:
```
❌ Failed: sale_deed.docx - Category not found: civil_001
```
Solution: Create category in Firestore first

**Invalid .docx file**:
```
❌ Failed: corrupt.docx - Failed to parse template
```
Solution: Check file is valid .docx format

**Storage upload failed**:
```
❌ Failed: large_file.docx - File too large
```
Solution: Optimize file size, remove large images

### Variable Parsing

The script automatically:

1. **Extracts variables** from `{{variable_name}}` patterns
2. **Generates labels** from variable names:
   - `party_a_name` → "Party A Name"
   - `contract_date` → "Contract Date"
   - `total_amount` → "Total Amount"

3. **Creates metadata** for each variable:
   ```json
   {
     "name": "party_a_name",
     "type": "STRING",
     "label": "Party A Name",
     "required": true,
     "description": "",
     "validation": null,
     "options": null
   }
   ```

4. **Variable types** default to `STRING` (can be edited in admin panel)

### Category Count Update

After import, script updates `templateCount` field in each category:

```javascript
// Before import
{
  "id": "civil_001",
  "name": "Civil Law",
  "templateCount": 0
}

// After import
{
  "id": "civil_001",
  "name": "Civil Law",
  "templateCount": 5  // Updated
}
```

### Typesense Indexing

Each template is indexed for search with:
- Template ID
- Name
- Description
- Category ID
- Category name
- Active status

Search becomes available immediately after indexing.

### Best Practices

1. **Test with small batch first**: Use `--batch 10` to test
2. **Validate templates locally**: Open .docx files to verify variables
3. **Create categories first**: Ensure all categoryIds exist in Firestore
4. **Check file sizes**: Keep templates under 5MB
5. **Use descriptive names**: Clear variable names improve UX
6. **Review errors.json**: Fix and re-import failed templates
7. **Backup before import**: Export existing templates if updating

### Batch Processing

**Small import** (< 50 templates):
```bash
npx tsx import-templates.ts
```

**Medium import** (50-500 templates):
```bash
npx tsx import-templates.ts --batch 100
```

**Large import** (> 500 templates):
```bash
# Process in chunks
npx tsx import-templates.ts --batch 100
# Wait for completion, then resume
npx tsx import-templates.ts --batch 100 --resume
```

### Cleanup

After successful import:

```bash
# Remove progress files
rm progress.json errors.json

# Archive templates
mkdir -p archive
mv templates/ archive/templates-$(date +%Y%m%d)
mv metadata.csv archive/metadata-$(date +%Y%m%d).csv
```

### Monitoring

During import:
- Check Firestore Console for new documents
- Verify Cloud Storage for uploaded files
- Test Typesense search
- Check category counts

### Performance

**Speed**:
- ~2-5 seconds per template (including all operations)
- 100 templates: ~5-10 minutes
- 1000 templates: ~45-60 minutes

**Optimization**:
- Progress saves every 100 templates (reduce disk I/O)
- Batch Firestore writes where possible
- Parallel Typesense indexing
- Resume capability prevents re-processing

### Troubleshooting

**Script hangs**:
- Check Firebase/Typesense connectivity
- Verify environment variables set correctly
- Check file permissions on templates/

**All imports fail**:
- Verify service account has Storage Admin role
- Check Firestore permissions
- Verify Typesense API key

**Partial imports**:
- Review errors.json for specific failures
- Fix issues and run with --resume
- Skip failed templates if not critical

## Future Scripts

Planned administrative scripts:

- `migrate-data.ts` - Database migration utility
- `export-templates.ts` - Bulk template export
- `seed-categories.ts` - Seed initial categories
- `cleanup-storage.ts` - Remove orphaned files
- `generate-reports.ts` - Usage analytics reports

## References

- [docxtemplater Documentation](https://docxtemplater.com/)
- [PizZip Documentation](https://github.com/open-xml-templating/pizzip)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Typesense API](https://typesense.org/docs/api/)

# Example Template Format

This document shows how to create templates for NyayaMitra.

## Basic Template Structure

Templates use docxtemplater syntax with `{{variable}}` placeholders.

### Example: Rental Agreement

```
RENTAL AGREEMENT

This Rental Agreement is made on {{agreement_date}} at {{place}}.

BETWEEN

{{landlord_name}}, aged {{landlord_age}} years, residing at {{landlord_address}}
(hereinafter referred to as "The Landlord")

AND

{{tenant_name}}, aged {{tenant_age}} years, residing at {{tenant_address}}
(hereinafter referred to as "The Tenant")

PROPERTY DETAILS

The Landlord agrees to rent the property located at:
{{property_address}}

RENT DETAILS

Monthly Rent: {{monthly_rent}}
Security Deposit: {{security_deposit}}
Rent Due Date: {{rent_due_date}} of each month

TERM

This agreement shall commence from {{start_date}} and shall continue for a period
of {{lease_duration}} months, ending on {{end_date}}.

TERMS AND CONDITIONS

1. The Tenant shall pay the monthly rent of {{monthly_rent}} on or before
   {{rent_due_date}} of each month.

2. The Tenant has paid a security deposit of {{security_deposit}} which will be
   refunded at the end of the tenancy.

3. {{additional_terms}}

SIGNATURES

Landlord: ____________________
Name: {{landlord_name}}
Date: {{signature_date}}

Tenant: ____________________
Name: {{tenant_name}}
Date: {{signature_date}}

WITNESSES

Witness 1: ____________________
Name: {{witness_1_name}}
Address: {{witness_1_address}}

Witness 2: ____________________
Name: {{witness_2_name}}
Address: {{witness_2_address}}
```

## Variable Types

After import, you can edit variable types in the admin panel:

### STRING Variables
- `landlord_name`
- `tenant_name`
- `place`

### TEXT Variables (Multi-line)
- `additional_terms`
- `property_description`

### DATE Variables
- `agreement_date`
- `start_date`
- `end_date`
- `signature_date`

### NUMBER Variables
- `landlord_age`
- `tenant_age`
- `lease_duration`

### CURRENCY Variables
- `monthly_rent`
- `security_deposit`

### PHONE Variables
- `landlord_phone`
- `tenant_phone`

### EMAIL Variables
- `landlord_email`
- `tenant_email`

## Variable Naming Conventions

**Good variable names**:
- `party_a_name` (clear, descriptive)
- `contract_date` (specific)
- `total_amount` (unambiguous)
- `property_address` (detailed)

**Bad variable names**:
- `name` (too generic)
- `date` (which date?)
- `amount` (what amount?)
- `addr` (abbreviated)

## Conditional Sections

You can use conditional sections (edited after import):

```
{#has_guarantor}
GUARANTOR DETAILS

Name: {{guarantor_name}}
Address: {{guarantor_address}}
{/has_guarantor}
```

## Repeating Sections

For lists of items (edited after import):

```
WITNESSES

{#witnesses}
Witness {{index}}: {{name}}
Address: {{address}}
{/witnesses}
```

## Best Practices

1. **Use consistent naming**: Follow `snake_case` convention
2. **Be specific**: Use detailed variable names
3. **Group related variables**: Use prefixes like `landlord_`, `tenant_`
4. **Add descriptions**: Document what each variable means
5. **Test thoroughly**: Open in Word to verify variables parse correctly
6. **Keep it simple**: Don't overuse conditionals/loops initially
7. **Validate output**: Generate sample drafts to test

## Template Checklist

Before importing:

- [ ] All variables use `{{variable_name}}` syntax
- [ ] Variable names are descriptive
- [ ] No typos in variable names
- [ ] Template opens correctly in Microsoft Word
- [ ] All placeholder values are replaced with variables
- [ ] Document formatting is preserved
- [ ] File is saved as .docx format
- [ ] File size is under 5MB
- [ ] Metadata CSV has correct entry for this template

## Example Metadata Entry

```csv
filename,name,description,categoryId,estimatedMinutes
rental_agreement.docx,Rental Agreement,Residential property rental agreement,civil_001,20
```

## Testing Template

After import, test the template:

1. Go to admin panel → Templates
2. Find your template
3. Click Edit to verify variables parsed correctly
4. Edit variable types if needed (STRING → DATE, etc.)
5. Set required/optional flags
6. Add validation rules if needed
7. Test generation in web/mobile app

## Common Issues

**Variables not parsing**:
- Check you're using `{{` and `}}` (double braces)
- Ensure no spaces inside braces: `{{name}}` not `{{ name }}`
- Verify .docx file format (not .doc)

**Formatting lost**:
- Use Word to create/edit templates (not Google Docs)
- Don't use complex formatting near variables
- Test with sample data

**File size too large**:
- Compress images
- Remove unnecessary formatting
- Split large templates into multiple files

## Advanced Features

### Tables

```
| Item | Description | Amount |
|------|-------------|--------|
| {#items}{{name}} | {{description}} | {{amount}}{/items} |
```

### Numbered Lists

```
1. {{term_1}}
2. {{term_2}}
3. {{term_3}}
```

### Signatures

```
________________________
{{party_name}}
{{party_designation}}
Date: {{signature_date}}
```

## Sample Templates

The `templates/` folder should contain actual .docx files created in Microsoft Word:

```
templates/
├── rental_agreement.docx        (Actual Word document)
├── sale_deed.docx              (Actual Word document)
├── employment_contract.docx    (Actual Word document)
└── power_of_attorney.docx      (Actual Word document)
```

Each file should:
- Be created in Microsoft Word
- Use variables with `{{name}}` syntax
- Be saved as .docx format
- Match the filename in metadata.csv

## Resources

- **docxtemplater Syntax**: https://docxtemplater.com/docs/syntax/
- **Template Examples**: Contact legal team for sample templates
- **Variable Guidelines**: See internal style guide

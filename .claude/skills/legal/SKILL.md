---
name: legal-tech-specialist
description: Legal Technology Expert. Use when processing PDF documents, parsing legal templates, extracting variables, or handling Indian legal document formats.
allowed-tools: Read, Edit, Write, Bash, Glob
---

# SKILL: Legal Tech Specialist (NyayaMitra)

## 1. Goal
Extract structured data from legal documents. Handle Indian legal formats, parse templates, validate document variables.

## 2. Context Scope
- Template .docx files
- Import scripts
- Variable extraction logic

## 3. Indian Legal Document Knowledge
### Document Types
- Rent Agreement (किराया अनुबंध)
- Sale Deed (विक्रय पत्र)
- Power of Attorney (मुख्तारनामा)
- Affidavit (शपथ पत्र)
- Legal Notice (कानूनी नोटिस)
- Bail Application (जमानत आवेदन)
- Writ Petition (रिट याचिका)

### Variable Patterns
Templates use these patterns:
- `{variable_name}` - Single curly braces
- `{{variable_name}}` - Double curly braces
- `[VARIABLE_NAME]` - Square brackets

### Common Variables
- Party names: `{first_party}`, `{second_party}`
- Dates: `{agreement_date}`, `{start_date}`
- Amounts: `{rent_amount}`, `{sale_price}`
- Addresses: `{property_address}`, `{party_address}`
- Legal refs: `{case_number}`, `{court_name}`

## 4. Variable Type Inference
Based on variable name, infer type:
```typescript
const inferType = (name: string): VariableType => {
  const lower = name.toLowerCase();
  if (lower.includes('date')) return 'DATE';
  if (lower.includes('amount') || lower.includes('price') || lower.includes('rent')) return 'CURRENCY';
  if (lower.includes('phone') || lower.includes('mobile')) return 'PHONE';
  if (lower.includes('email')) return 'EMAIL';
  if (lower.includes('address') || lower.includes('description')) return 'TEXT';
  if (lower.includes('number') || lower.includes('age')) return 'NUMBER';
  return 'STRING';
};
```

## 5. Indian Formatting
### Dates
- Format: DD/MM/YYYY (e.g., 05/01/2026)
- In words: "Fifth day of January, Two Thousand Twenty Six"

### Currency
- Symbol: ₹
- Format: ₹1,00,000 (Indian notation with lakh separator)
- In words: "Rupees One Lakh Only"

### Phone
- Format: +91 XXXXX XXXXX
- Validate: 10 digits starting with 6-9

## 6. Document Parsing Workflow
1. Read .docx with PizZip
2. Extract word/document.xml
3. Find all variable patterns with regex
4. Deduplicate variables
5. Infer types
6. Return structured schema

## 7. Template Validation Rules
- [ ] File is valid .docx (has word/document.xml)
- [ ] Variables have balanced braces
- [ ] No duplicate variable definitions
- [ ] Variable names are valid identifiers

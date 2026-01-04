# NyayaMitra Admin Panel

Admin panel for managing NyayaMitra templates, categories, and users.

## Features

- **Dashboard**: View platform statistics (users, drafts, revenue, subscriptions)
- **Templates**: Create, edit, and manage legal document templates with variable parsing
- **Categories**: CRUD operations for template categories
- **Users**: View and search user accounts with subscription details

## Authentication

Admin access requires:
- Email/password authentication
- Admin custom claim set in Firebase Auth

## Getting Started

1. Install dependencies:
```bash
pnpm install
```

2. Set up environment variables:
```bash
cp .env.local.example .env.local
# Edit .env.local with your Firebase credentials
```

3. Run development server:
```bash
pnpm dev
```

Admin panel runs on http://localhost:3001

## Template Upload

The template upload feature:
- Accepts .docx files only
- Automatically parses variables using docxtemplater
- Extracts variables in `{{variable_name}}` format
- Allows customization of variable types, labels, and required status

## Tech Stack

- Next.js 14 (App Router)
- React Query
- Firebase Auth (admin claim verification)
- Tailwind CSS
- docxtemplater (template parsing)
- PizZip (DOCX processing)

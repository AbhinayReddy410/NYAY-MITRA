# NyayaMitra Setup Guide

Complete setup guide for the NyayaMitra monorepo.

## Prerequisites

- **Node.js** 20 LTS
- **pnpm** 8+
- **Firebase CLI** (`npm install -g firebase-tools`)
- **Firebase project** (Mumbai region)
- **Razorpay account** (test/live keys)
- **Typesense Cloud** account (Mumbai PoP)
- **Google Cloud project** with Cloud Run, Firestore, Storage enabled

## Quick Start

```bash
# 1. Clone repository
git clone <repository-url>
cd nyayamitra

# 2. Install all dependencies
pnpm install

# 3. Set up environment variables (see sections below)

# 4. Start development servers
pnpm dev  # All apps in parallel
```

## Environment Setup

### API (services/api/.env)

```bash
cd services/api
cp .env.example .env
```

Edit `.env`:
```
PORT=3000
NODE_ENV=development
FIREBASE_PROJECT_ID=nyayamitra-prod
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
TYPESENSE_HOST=xxx.a1.typesense.net
TYPESENSE_API_KEY=xyz123
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=xxx
```

**Get FIREBASE_SERVICE_ACCOUNT**:
1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate new private key"
3. Copy entire JSON content as one line

### Web App (apps/web/.env.local)

```bash
cd apps/web
cp .env.local.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=nyayamitra-prod.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=nyayamitra-prod
```

**Get Firebase config**:
1. Firebase Console → Project Settings → General
2. Scroll to "Your apps" → Web app
3. Copy config values

### Admin App (apps/admin/.env.local)

```bash
cd apps/admin
cp .env.local.example .env.local
```

Edit `.env.local` (same as web app):
```
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=nyayamitra-prod.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=nyayamitra-prod
```

### Mobile App (apps/mobile/.env)

```bash
cd apps/mobile
cp .env.example .env
```

Edit `.env`:
```
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSy...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=nyayamitra-prod.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=nyayamitra-prod
```

## Firebase Setup

### 1. Deploy Security Rules

```bash
cd infra/firebase

# Login to Firebase
firebase login

# Select project
firebase use nyayamitra-prod

# Deploy rules and indexes
./deploy.sh
```

### 2. Set Admin Claim

```bash
cd infra/firebase

# Install dependencies
npm install

# Set admin claim on your user
export FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/serviceAccount.json
node set-admin.js admin@nyayamitra.com
```

### 3. Upload Initial Data

**Create categories**:
```bash
# Use admin panel at http://localhost:3001/categories
# Or use Firebase Console
```

**Upload templates**:
```bash
# Use admin panel at http://localhost:3001/templates/new
# Upload .docx files with {{variable}} placeholders
```

## Razorpay Setup

### 1. Create Plans

Go to Razorpay Dashboard → Subscriptions → Plans:

**Pro Plan**:
- Plan ID: `plan_pro_monthly`
- Billing Interval: Monthly
- Amount: ₹499

**Unlimited Plan**:
- Plan ID: `plan_unlimited_monthly`
- Billing Interval: Monthly
- Amount: ₹1999

### 2. Configure Webhook

1. Go to Razorpay Dashboard → Webhooks
2. Create new webhook endpoint
3. URL: `https://your-api-domain.com/payments/webhook`
4. Events:
   - `subscription.activated`
   - `subscription.charged`
   - `subscription.cancelled`
   - `subscription.halted`
5. Copy webhook secret to API `.env` as `RAZORPAY_WEBHOOK_SECRET`

## Typesense Setup

### 1. Create Cluster

1. Sign up at [Typesense Cloud](https://cloud.typesense.org)
2. Create cluster in Mumbai region
3. Copy hostname and API key to API `.env`

### 2. Create Collections

```bash
# Templates collection
curl "http://localhost:8108/collections" \
  -X POST \
  -H "X-TYPESENSE-API-KEY: xyz123" \
  -d '{
    "name": "templates",
    "fields": [
      {"name": "id", "type": "string"},
      {"name": "name", "type": "string"},
      {"name": "description", "type": "string"},
      {"name": "categoryId", "type": "string"},
      {"name": "categoryName", "type": "string"},
      {"name": "isActive", "type": "bool"}
    ]
  }'
```

## Development Workflow

### Start All Services

```bash
# From repository root
pnpm dev
```

This starts:
- API server: http://localhost:3000
- Web app: http://localhost:3000 (Next.js dev port)
- Admin app: http://localhost:3001
- Mobile app: Expo dev server

### Start Individual Services

```bash
# API only
pnpm --filter @nyayamitra/api dev

# Web app only
pnpm --filter @nyayamitra/web dev

# Admin app only
pnpm --filter @nyayamitra/admin dev

# Mobile app only
pnpm --filter @nyayamitra/mobile start
```

### Build for Production

```bash
# Build all packages
pnpm build

# Build individual packages
pnpm --filter @nyayamitra/api build
pnpm --filter @nyayamitra/web build
pnpm --filter @nyayamitra/admin build
```

### Run Tests

```bash
# All tests
pnpm test

# API tests only
pnpm --filter @nyayamitra/api test

# Single test file
pnpm --filter @nyayamitra/api test -- src/routes/drafts.test.ts
```

### Linting

```bash
# Lint all packages
pnpm lint

# Lint specific package
pnpm --filter @nyayamitra/web lint
```

## Firebase Emulators (Local Development)

Run Firebase services locally:

```bash
cd infra/firebase
./emulator.sh
```

Emulator UI: http://localhost:4000

Update `.env` files to use emulator:
```
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=localhost
```

## Mobile Development

### iOS

```bash
cd apps/mobile
pnpm ios
```

Requirements:
- macOS with Xcode installed
- iOS Simulator

### Android

```bash
cd apps/mobile
pnpm android
```

Requirements:
- Android Studio
- Android emulator or physical device

## Deployment

### API (Cloud Run)

```bash
cd services/api

# Build container
gcloud builds submit --tag gcr.io/nyayamitra-prod/api

# Deploy
gcloud run deploy api \
  --image gcr.io/nyayamitra-prod/api \
  --platform managed \
  --region asia-south1 \
  --allow-unauthenticated
```

### Web App (Vercel)

```bash
cd apps/web

# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

### Admin App (Vercel)

```bash
cd apps/admin
vercel --prod
```

### Mobile App (EAS)

```bash
cd apps/mobile

# Install EAS CLI
npm install -g eas-cli

# Configure
eas build:configure

# Build
eas build --platform all

# Submit to stores
eas submit
```

## Troubleshooting

### "Firebase API key invalid"

- Check `.env.local` has correct `NEXT_PUBLIC_FIREBASE_API_KEY`
- Verify Firebase project settings
- Ensure API key restrictions allow your domain

### "Admin claim not working"

```bash
# Re-run set-admin script
node infra/firebase/set-admin.js admin@example.com

# User must sign out and sign in again
```

### "Firestore permission denied"

- Check security rules are deployed: `firebase deploy --only firestore:rules`
- Verify user is authenticated
- Check user UID matches document path

### "Template parsing fails"

- Ensure .docx file uses `{{variable_name}}` syntax
- Check template file is not corrupted
- Verify docxtemplater version matches package.json

### "Razorpay webhook not working"

- Check webhook secret in `.env` matches Razorpay dashboard
- Verify webhook URL is publicly accessible
- Check signature verification in logs

## Project Structure Reference

```
nyayamitra/
├── apps/
│   ├── admin/          # Next.js admin panel (port 3001)
│   ├── mobile/         # Expo React Native app
│   └── web/            # Next.js user-facing app
├── packages/
│   └── shared/         # Shared TypeScript types
├── services/
│   └── api/            # Hono API server (port 3000)
├── infra/
│   └── firebase/       # Firebase rules and scripts
└── scripts/            # CLI utilities
```

## Next Steps

1. ✅ Install dependencies: `pnpm install`
2. ✅ Set up environment variables
3. ✅ Deploy Firebase rules
4. ✅ Set admin claim on your user
5. ✅ Start dev servers: `pnpm dev`
6. ✅ Access admin panel: http://localhost:3001
7. ✅ Create categories and upload templates
8. ✅ Test draft generation flow

## Support

- Documentation: `/docs`
- Issues: GitHub Issues
- Email: support@nyayamitra.com

## License

Proprietary - All rights reserved

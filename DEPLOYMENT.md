# NyayaMitra Deployment Guide

Complete guide for deploying NyayaMitra to production using GitHub Actions.

## Overview

The NyayaMitra project uses GitHub Actions for automated CI/CD:

- **CI Pipeline**: Runs on every push and PR (lint, test, type-check, build)
- **API Deployment**: Automatic deployment to Cloud Run (Mumbai) on changes to API
- **Web Deployment**: Automatic deployment to Firebase Hosting on changes to web app
- **Admin Deployment**: Automatic deployment to Firebase Hosting on changes to admin panel

## Prerequisites

Before setting up deployment:

- ✅ GCP project with billing enabled
- ✅ Firebase project linked to GCP
- ✅ GitHub repository
- ✅ Domain names configured (optional)

## Quick Setup

### 1. GCP Configuration

```bash
# Run automated setup script
cd .github
./gcp-setup.sh
```

This script:
- Enables required GCP APIs
- Creates Artifact Registry repository
- Sets up Secret Manager
- Configures service account permissions

### 2. GitHub Secrets

```bash
# Run automated secrets setup
cd .github
./setup-secrets.sh
```

Or manually add secrets in GitHub repository settings:

**Required Secrets**:
- `GCP_PROJECT_ID`
- `GCP_SERVICE_ACCOUNT_KEY`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_SERVICE_ACCOUNT`
- `PRODUCTION_API_URL`
- `TYPESENSE_HOST`
- `TYPESENSE_API_KEY`
- `RAZORPAY_KEY_ID`

### 3. Firebase Hosting

Configure hosting targets:

```bash
# Web app
cd apps/web
firebase target:apply hosting web nyayamitra-web

# Admin panel
cd apps/admin
firebase target:apply hosting admin nyayamitra-admin
```

### 4. Trigger Deployment

Push to `main` branch:

```bash
git add .
git commit -m "feat: initial deployment"
git push origin main
```

## Architecture

### API Deployment Flow

```
GitHub Push → Build Docker Image → Push to Artifact Registry → Deploy to Cloud Run → Health Check
```

**Details**:
- Multi-stage Docker build (builder + runner)
- Image pushed to: `asia-south1-docker.pkg.dev/{PROJECT}/nyayamitra/nyayamitra-api`
- Deployed to Cloud Run in `asia-south1` region
- Environment variables set from GitHub secrets
- Sensitive secrets loaded from GCP Secret Manager
- Health check runs on `/health` endpoint

### Web/Admin Deployment Flow

```
GitHub Push → Build Next.js → Deploy to Firebase Hosting → CDN Distribution
```

**Details**:
- Static export of Next.js app
- Deployed to Firebase Hosting
- Automatic CDN distribution
- Custom domain support
- HTTPS enabled by default

## Environment Variables

### API (Cloud Run)

Set via `--set-env-vars`:
- `NODE_ENV=production`
- `FIREBASE_PROJECT_ID`
- `TYPESENSE_HOST`
- `TYPESENSE_API_KEY`
- `RAZORPAY_KEY_ID`

Set via `--set-secrets` (from Secret Manager):
- `FIREBASE_SERVICE_ACCOUNT=firebase-service-account:latest`
- `RAZORPAY_KEY_SECRET=razorpay-secret:latest`
- `RAZORPAY_WEBHOOK_SECRET=razorpay-webhook-secret:latest`

### Web/Admin (Firebase Hosting)

Set via build-time environment variables:
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`

## Manual Deployment

### API to Cloud Run

```bash
# Build Docker image
cd /path/to/nyayamitra
docker build -t asia-south1-docker.pkg.dev/nyayamitra-prod/nyayamitra/nyayamitra-api:v1 \
  -f services/api/Dockerfile .

# Push to Artifact Registry
docker push asia-south1-docker.pkg.dev/nyayamitra-prod/nyayamitra/nyayamitra-api:v1

# Deploy to Cloud Run
gcloud run deploy nyayamitra-api \
  --image asia-south1-docker.pkg.dev/nyayamitra-prod/nyayamitra/nyayamitra-api:v1 \
  --platform managed \
  --region asia-south1 \
  --allow-unauthenticated \
  --service-account cloud-run-api@nyayamitra-prod.iam.gserviceaccount.com
```

### Web to Firebase Hosting

```bash
cd apps/web
pnpm build
firebase deploy --only hosting:web
```

### Admin to Firebase Hosting

```bash
cd apps/admin
pnpm build
firebase deploy --only hosting:admin
```

## Custom Domains

### API Domain

```bash
# Map custom domain to Cloud Run
gcloud run domain-mappings create \
  --service nyayamitra-api \
  --domain api.nyayamitra.com \
  --region asia-south1
```

### Web Domain

```bash
# Add custom domain in Firebase Console
# Hosting → Domain → Add custom domain → Follow wizard
```

## Monitoring

### GitHub Actions

View workflow runs:
- Go to repository → Actions tab
- Click on workflow name
- View logs for each step

### Cloud Run

```bash
# View service details
gcloud run services describe nyayamitra-api --region asia-south1

# View logs
gcloud run services logs read nyayamitra-api --region asia-south1 --limit 50

# Monitor metrics
gcloud monitoring dashboards list
```

### Firebase Hosting

- Firebase Console → Hosting
- View deployment history
- Check traffic and bandwidth usage

## Rollback

### API Rollback

```bash
# List revisions
gcloud run revisions list --service nyayamitra-api --region asia-south1

# Route traffic to previous revision
gcloud run services update-traffic nyayamitra-api \
  --to-revisions REVISION_NAME=100 \
  --region asia-south1
```

### Web/Admin Rollback

Use Firebase Console:
1. Go to Hosting
2. Click on site name
3. Release history
4. Click "..." → Rollback

## Cost Optimization

### Cloud Run

- **Min instances**: 1 (keeps service warm, reduces cold starts)
- **Max instances**: 10 (prevents runaway costs)
- **Memory**: 512Mi (adjust based on usage)
- **CPU**: 1 vCPU (sufficient for API load)

**Estimated cost**: ~$10-30/month for moderate traffic

### Firebase Hosting

- Free tier: 10GB storage, 360MB/day transfer
- Paid tier: $0.026/GB storage, $0.15/GB transfer

**Estimated cost**: Free tier sufficient for MVP

### Artifact Registry

- Storage: $0.10/GB per month
- Estimated cost: $1-5/month

## Security

### API Security

- ✅ HTTPS enforced by Cloud Run
- ✅ Secrets stored in Secret Manager (not environment variables)
- ✅ Service account with least privilege
- ✅ Firestore security rules enforced
- ✅ Rate limiting configured

### Web/Admin Security

- ✅ HTTPS enforced by Firebase Hosting
- ✅ Security headers configured (X-Frame-Options, CSP, etc.)
- ✅ Firebase Auth for authentication
- ✅ Admin custom claims verified
- ✅ Static file caching optimized

## Troubleshooting

### Deployment Fails

**Check logs**:
```bash
# GitHub Actions logs
# Repository → Actions → Click on failed workflow

# Cloud Run deployment logs
gcloud run services logs read nyayamitra-api --region asia-south1
```

**Common issues**:
- Missing GitHub secrets
- Invalid service account credentials
- Docker build failures
- Health check timeout

### API Not Responding

**Check health**:
```bash
curl https://YOUR_CLOUD_RUN_URL/health
```

**Check logs**:
```bash
gcloud run services logs read nyayamitra-api --region asia-south1 --limit 100
```

### Web/Admin Not Loading

**Check deployment status**:
```bash
firebase hosting:channel:list
```

**Check build output**:
- Review GitHub Actions build logs
- Verify Next.js build succeeded
- Check for build errors

## Best Practices

1. **Never commit secrets** - Use GitHub secrets and GCP Secret Manager
2. **Test locally first** - Run `pnpm build` before pushing
3. **Use pull requests** - CI runs on PRs before merging
4. **Monitor deployments** - Watch GitHub Actions and Cloud Console
5. **Set up alerts** - Configure Cloud Monitoring alerts
6. **Review logs regularly** - Check for errors and warnings
7. **Keep dependencies updated** - Run `pnpm update` regularly
8. **Use semantic versioning** - Tag releases with version numbers

## CI/CD Pipeline Stages

### Stage 1: CI (Continuous Integration)

**Triggers**: Every push, every PR

**Jobs**:
1. Lint all code
2. Run all tests
3. Type-check TypeScript
4. Build all packages

**Duration**: ~5-10 minutes

### Stage 2: Deploy API

**Triggers**: Push to main with API changes

**Jobs**:
1. Build Docker image
2. Push to Artifact Registry
3. Deploy to Cloud Run
4. Run health check

**Duration**: ~8-12 minutes

### Stage 3: Deploy Web/Admin

**Triggers**: Push to main with web/admin changes

**Jobs**:
1. Build Next.js app
2. Deploy to Firebase Hosting
3. Verify deployment

**Duration**: ~5-8 minutes

## Performance Optimization

### API

- Multi-stage Docker build (smaller image)
- Production dependencies only in runner stage
- Health check ensures service availability
- Min instances prevent cold starts

### Web/Admin

- Next.js static export (fast CDN delivery)
- Image optimization
- Code splitting
- Cache headers configured
- Compression enabled

## Scaling

### API Scaling

Cloud Run automatically scales based on:
- Incoming requests
- CPU utilization
- Memory usage

Configuration:
- Min instances: 1
- Max instances: 10
- Concurrency: 80 (default)

### Web/Admin Scaling

Firebase Hosting scales automatically:
- Global CDN distribution
- No server management required
- Handles traffic spikes automatically

## Support

For deployment issues:
- Check `.github/workflows/README.md`
- Review workflow logs in GitHub Actions
- Check GCP Cloud Console
- Open GitHub issue with logs

## References

- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Cloud Run Docs](https://cloud.google.com/run/docs)
- [Firebase Hosting Docs](https://firebase.google.com/docs/hosting)
- [Docker Multi-stage Builds](https://docs.docker.com/build/building/multi-stage/)

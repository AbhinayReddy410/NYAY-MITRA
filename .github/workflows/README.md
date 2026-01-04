# GitHub Actions Workflows

Automated CI/CD pipelines for NyayaMitra.

## Workflows

### 1. CI (Continuous Integration)

**File**: `ci.yml`

**Triggers**:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

**Jobs**:
- **Lint**: Runs ESLint on all packages
- **Test**: Runs unit and integration tests
- **Build**: Builds all packages in matrix (shared, api, web, admin)
- **Type Check**: Validates TypeScript types across all packages

**Concurrency**: Cancels previous runs when new commits pushed

**Timeout**: 10-20 minutes per job

### 2. Deploy API

**File**: `deploy-api.yml`

**Triggers**:
- Push to `main` branch
- Changes in `services/api/**` or `packages/shared/**`

**Steps**:
1. Checkout code
2. Authenticate to Google Cloud
3. Configure Docker for Artifact Registry
4. Build Docker image with multi-stage build
5. Push image to Artifact Registry (asia-south1)
6. Deploy to Cloud Run (asia-south1)
7. Run health check
8. Notify deployment status

**Configuration**:
- Region: `asia-south1` (Mumbai)
- Min instances: 1
- Max instances: 10
- Memory: 512Mi
- CPU: 1 vCPU
- Timeout: 300s

**Secrets Used**:
- Firebase service account (from Secret Manager)
- Razorpay keys (from Secret Manager)
- Typesense credentials (environment variables)

### 3. Deploy Web

**File**: `deploy-web.yml`

**Triggers**:
- Push to `main` branch
- Changes in `apps/web/**` or `packages/shared/**`

**Steps**:
1. Checkout code
2. Install dependencies with pnpm
3. Build shared package
4. Build Next.js web app
5. Deploy to Firebase Hosting

**Target**: `web` site

**URL**: `https://{PROJECT_ID}.web.app`

### 4. Deploy Admin

**File**: `deploy-admin.yml`

**Triggers**:
- Push to `main` branch
- Changes in `apps/admin/**` or `packages/shared/**`

**Steps**:
1. Checkout code
2. Install dependencies with pnpm
3. Build shared package
4. Build Next.js admin app
5. Deploy to Firebase Hosting

**Target**: `admin` site

**URL**: `https://{PROJECT_ID}.admin.app`

## Required GitHub Secrets

### Google Cloud Platform

- `GCP_PROJECT_ID` - GCP project ID (e.g., `nyayamitra-prod`)
- `GCP_SERVICE_ACCOUNT_KEY` - Service account JSON key with permissions:
  - Cloud Run Admin
  - Artifact Registry Writer
  - Service Account User

### Firebase

- `FIREBASE_PROJECT_ID` - Firebase project ID
- `FIREBASE_API_KEY` - Firebase web API key
- `FIREBASE_AUTH_DOMAIN` - Firebase auth domain (e.g., `nyayamitra-prod.firebaseapp.com`)
- `FIREBASE_SERVICE_ACCOUNT` - Firebase service account JSON (for hosting deploy)

### API Configuration

- `PRODUCTION_API_URL` - Production API URL (e.g., `https://api.nyayamitra.com`)

### Typesense

- `TYPESENSE_HOST` - Typesense server hostname
- `TYPESENSE_API_KEY` - Typesense API key

### Razorpay

- `RAZORPAY_KEY_ID` - Razorpay key ID (test or live)
- `RAZORPAY_KEY_SECRET` - Razorpay key secret (stored in Secret Manager)
- `RAZORPAY_WEBHOOK_SECRET` - Razorpay webhook secret (stored in Secret Manager)

## Google Cloud Secret Manager

Sensitive secrets are stored in GCP Secret Manager and referenced in Cloud Run deployment:

```yaml
--set-secrets "FIREBASE_SERVICE_ACCOUNT=firebase-service-account:latest"
--set-secrets "RAZORPAY_KEY_SECRET=razorpay-secret:latest"
--set-secrets "RAZORPAY_WEBHOOK_SECRET=razorpay-webhook-secret:latest"
```

### Creating Secrets

```bash
# Firebase service account
gcloud secrets create firebase-service-account \
  --data-file=serviceAccount.json \
  --replication-policy=automatic

# Razorpay secret
echo -n "your_razorpay_secret" | gcloud secrets create razorpay-secret \
  --data-file=- \
  --replication-policy=automatic

# Razorpay webhook secret
echo -n "your_webhook_secret" | gcloud secrets create razorpay-webhook-secret \
  --data-file=- \
  --replication-policy=automatic
```

### Granting Access

```bash
# Get Cloud Run service account
SERVICE_ACCOUNT=$(gcloud run services describe nyayamitra-api \
  --region asia-south1 \
  --format 'value(spec.template.spec.serviceAccountName)')

# Grant access to secrets
gcloud secrets add-iam-policy-binding firebase-service-account \
  --member "serviceAccount:$SERVICE_ACCOUNT" \
  --role "roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding razorpay-secret \
  --member "serviceAccount:$SERVICE_ACCOUNT" \
  --role "roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding razorpay-webhook-secret \
  --member "serviceAccount:$SERVICE_ACCOUNT" \
  --role "roles/secretmanager.secretAccessor"
```

## Setting Up GitHub Secrets

1. Go to repository **Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Add each secret from the list above

## Artifact Registry Setup

Create Artifact Registry repository:

```bash
gcloud artifacts repositories create nyayamitra \
  --repository-format=docker \
  --location=asia-south1 \
  --description="Docker images for NyayaMitra"
```

## Firebase Hosting Setup

Configure Firebase hosting targets:

```bash
cd apps/web
firebase target:apply hosting web nyayamitra-web

cd apps/admin
firebase target:apply hosting admin nyayamitra-admin
```

Update `.firebaserc`:

```json
{
  "projects": {
    "default": "nyayamitra-prod"
  },
  "targets": {
    "nyayamitra-prod": {
      "hosting": {
        "web": ["nyayamitra-web"],
        "admin": ["nyayamitra-admin"]
      }
    }
  }
}
```

## Deployment Flow

### API Deployment

1. Push to `main` with changes in `services/api/**`
2. GitHub Actions triggers `deploy-api.yml`
3. Docker image built and pushed to Artifact Registry
4. Cloud Run service updated with new image
5. Health check validates deployment
6. Service available at Cloud Run URL

### Web/Admin Deployment

1. Push to `main` with changes in `apps/web/**` or `apps/admin/**`
2. GitHub Actions triggers respective deploy workflow
3. Next.js app built with static export
4. Static files deployed to Firebase Hosting
5. Site available at Firebase Hosting URL

## Manual Deployment

### API

```bash
# Build and push manually
cd services/api
docker build -t asia-south1-docker.pkg.dev/nyayamitra-prod/nyayamitra/nyayamitra-api:manual -f Dockerfile ../..
docker push asia-south1-docker.pkg.dev/nyayamitra-prod/nyayamitra/nyayamitra-api:manual

# Deploy manually
gcloud run deploy nyayamitra-api \
  --image asia-south1-docker.pkg.dev/nyayamitra-prod/nyayamitra/nyayamitra-api:manual \
  --region asia-south1
```

### Web/Admin

```bash
# Build and deploy manually
cd apps/web
pnpm build
firebase deploy --only hosting:web

cd apps/admin
pnpm build
firebase deploy --only hosting:admin
```

## Monitoring

### GitHub Actions

View workflow runs:
- Repository → **Actions** tab
- Click on workflow name
- View logs for each job

### Cloud Run

Monitor API deployment:
```bash
gcloud run services describe nyayamitra-api --region asia-south1
gcloud run services logs nyayamitra-api --region asia-south1
```

### Firebase Hosting

View deployment history:
- Firebase Console → Hosting
- Click on site name
- View release history

## Rollback Procedures

### API Rollback

```bash
# List previous revisions
gcloud run revisions list --service nyayamitra-api --region asia-south1

# Rollback to specific revision
gcloud run services update-traffic nyayamitra-api \
  --to-revisions REVISION_NAME=100 \
  --region asia-south1
```

### Web/Admin Rollback

```bash
# List previous versions
firebase hosting:channel:list

# Rollback via Firebase Console
# Hosting → Release History → Rollback
```

## Troubleshooting

### Build Failures

- Check workflow logs in GitHub Actions
- Verify all secrets are set correctly
- Ensure dependencies are up to date

### Deployment Failures

- Check Cloud Run logs: `gcloud run services logs nyayamitra-api`
- Verify Secret Manager access permissions
- Check environment variable configuration

### Health Check Failures

- API must respond to `/health` endpoint
- Ensure port 8080 is exposed
- Check Cloud Run service logs

## Best Practices

1. **Always test locally** before pushing to `main`
2. **Run CI checks** on pull requests before merging
3. **Monitor deployments** in GitHub Actions and Cloud Console
4. **Use semantic versioning** for Docker image tags
5. **Keep secrets secure** - never commit to repository
6. **Review deployment logs** after each release
7. **Set up alerts** for deployment failures

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Firebase Hosting Documentation](https://firebase.google.com/docs/hosting)
- [Artifact Registry Documentation](https://cloud.google.com/artifact-registry/docs)

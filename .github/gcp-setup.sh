#!/bin/bash

# GCP Setup Script for NyayaMitra
# Sets up Artifact Registry, Secret Manager, and Cloud Run configuration

set -e

PROJECT_ID=""
REGION="asia-south1"
REPOSITORY="nyayamitra"

echo "☁️  NyayaMitra GCP Setup"
echo "========================"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Google Cloud SDK not found. Install it from:"
    echo "   https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if logged in
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
    echo "❌ Not logged in to Google Cloud. Run:"
    echo "   gcloud auth login"
    exit 1
fi

echo "✅ Google Cloud SDK authenticated"
echo ""

# Get project ID
read -p "Enter GCP project ID (e.g., nyayamitra-prod): " PROJECT_ID

# Set project
gcloud config set project "$PROJECT_ID"

echo ""
echo "📋 Project: $PROJECT_ID"
echo "📍 Region: $REGION"
echo ""

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    secretmanager.googleapis.com \
    cloudbuild.googleapis.com

echo "✅ APIs enabled"
echo ""

# Create Artifact Registry repository
echo "📦 Creating Artifact Registry repository..."
if gcloud artifacts repositories describe "$REPOSITORY" --location="$REGION" &> /dev/null; then
    echo "   Repository already exists"
else
    gcloud artifacts repositories create "$REPOSITORY" \
        --repository-format=docker \
        --location="$REGION" \
        --description="Docker images for NyayaMitra"
    echo "   ✅ Repository created"
fi

echo ""

# Create secrets in Secret Manager
echo "🔐 Creating secrets in Secret Manager..."
echo ""

create_secret() {
    local secret_name=$1
    local secret_description=$2

    if gcloud secrets describe "$secret_name" &> /dev/null; then
        echo "   Secret $secret_name already exists"
    else
        echo "📝 Creating secret: $secret_name"
        echo "   Description: $secret_description"
        read -sp "   Enter value (or path to file): " secret_input
        echo ""

        if [ -f "$secret_input" ]; then
            gcloud secrets create "$secret_name" \
                --data-file="$secret_input" \
                --replication-policy=automatic
        else
            echo -n "$secret_input" | gcloud secrets create "$secret_name" \
                --data-file=- \
                --replication-policy=automatic
        fi

        echo "   ✅ Secret created"
        echo ""
    fi
}

create_secret "firebase-service-account" "Firebase Admin SDK service account JSON"
create_secret "razorpay-secret" "Razorpay key secret"
create_secret "razorpay-webhook-secret" "Razorpay webhook secret"

echo "✅ All secrets created"
echo ""

# Grant Secret Manager access to Cloud Run service account
echo "🔑 Configuring service account permissions..."
echo ""

# Get or create service account
SERVICE_ACCOUNT="cloud-run-api@${PROJECT_ID}.iam.gserviceaccount.com"

if gcloud iam service-accounts describe "$SERVICE_ACCOUNT" &> /dev/null; then
    echo "   Service account exists: $SERVICE_ACCOUNT"
else
    echo "   Creating service account..."
    gcloud iam service-accounts create cloud-run-api \
        --display-name="Cloud Run API Service Account"
fi

# Grant Secret Accessor role
echo "   Granting Secret Manager access..."
for secret in firebase-service-account razorpay-secret razorpay-webhook-secret; do
    gcloud secrets add-iam-policy-binding "$secret" \
        --member="serviceAccount:$SERVICE_ACCOUNT" \
        --role="roles/secretmanager.secretAccessor" \
        --quiet
done

echo "   ✅ Permissions configured"
echo ""

# Summary
echo "✅ GCP setup complete!"
echo ""
echo "📋 Summary:"
echo "   - Artifact Registry: $REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY"
echo "   - Secrets created: firebase-service-account, razorpay-secret, razorpay-webhook-secret"
echo "   - Service account: $SERVICE_ACCOUNT"
echo ""
echo "📝 Next steps:"
echo "   1. Configure GitHub secrets (run .github/setup-secrets.sh)"
echo "   2. Push to main branch to trigger deployment"
echo "   3. Monitor deployment in GitHub Actions"
echo ""
echo "For detailed instructions, see .github/workflows/README.md"

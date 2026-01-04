#!/bin/bash

# GitHub Secrets Setup Script for NyayaMitra
# This script helps you set up all required GitHub secrets for CI/CD

set -e

REPO_OWNER=""
REPO_NAME=""

echo "🔐 NyayaMitra GitHub Secrets Setup"
echo "===================================="
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) not found. Install it with:"
    echo "   brew install gh"
    echo "   or visit: https://cli.github.com/"
    exit 1
fi

# Check if logged in
if ! gh auth status &> /dev/null; then
    echo "❌ Not logged in to GitHub. Run:"
    echo "   gh auth login"
    exit 1
fi

echo "✅ GitHub CLI authenticated"
echo ""

# Get repository info
read -p "Enter repository owner (e.g., your-username): " REPO_OWNER
read -p "Enter repository name (e.g., nyayamitra): " REPO_NAME

echo ""
echo "Repository: $REPO_OWNER/$REPO_NAME"
echo ""

# Function to set secret
set_secret() {
    local secret_name=$1
    local secret_description=$2
    local is_multiline=${3:-false}

    echo "📝 Setting $secret_name"
    echo "   Description: $secret_description"

    if [ "$is_multiline" = true ]; then
        echo "   Enter value (paste multi-line, then Ctrl+D):"
        secret_value=$(cat)
    else
        read -sp "   Enter value: " secret_value
        echo ""
    fi

    echo "$secret_value" | gh secret set "$secret_name" \
        --repo "$REPO_OWNER/$REPO_NAME"

    echo "   ✅ $secret_name set"
    echo ""
}

echo "Setting up GCP secrets..."
echo "========================="
echo ""

set_secret "GCP_PROJECT_ID" "GCP project ID (e.g., nyayamitra-prod)"
set_secret "GCP_SERVICE_ACCOUNT_KEY" "Service account JSON key" true

echo "Setting up Firebase secrets..."
echo "=============================="
echo ""

set_secret "FIREBASE_PROJECT_ID" "Firebase project ID"
set_secret "FIREBASE_API_KEY" "Firebase web API key"
set_secret "FIREBASE_AUTH_DOMAIN" "Firebase auth domain (e.g., project.firebaseapp.com)"
set_secret "FIREBASE_SERVICE_ACCOUNT" "Firebase service account JSON for hosting" true

echo "Setting up API configuration..."
echo "==============================="
echo ""

set_secret "PRODUCTION_API_URL" "Production API URL (e.g., https://api.nyayamitra.com)"

echo "Setting up Typesense secrets..."
echo "================================"
echo ""

set_secret "TYPESENSE_HOST" "Typesense server hostname"
set_secret "TYPESENSE_API_KEY" "Typesense API key"

echo "Setting up Razorpay secrets..."
echo "==============================="
echo ""

set_secret "RAZORPAY_KEY_ID" "Razorpay key ID (test or live)"

echo ""
echo "✅ All secrets configured successfully!"
echo ""
echo "📋 Next steps:"
echo "   1. Set up GCP Secret Manager for sensitive API secrets"
echo "   2. Configure Artifact Registry"
echo "   3. Set up Firebase Hosting targets"
echo "   4. Push to main branch to trigger deployments"
echo ""
echo "For detailed instructions, see .github/workflows/README.md"

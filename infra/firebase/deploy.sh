#!/bin/bash

# NyayaMitra Firebase Deployment Script
# Deploys Firestore rules, Storage rules, and indexes to Firebase

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 NyayaMitra Firebase Deployment"
echo "=================================="
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Install it with:"
    echo "   npm install -g firebase-tools"
    exit 1
fi

# Check if logged in
echo "Checking Firebase authentication..."
if ! firebase projects:list &> /dev/null; then
    echo "❌ Not logged in to Firebase. Run:"
    echo "   firebase login"
    exit 1
fi

echo "✅ Authenticated"
echo ""

# Show current project
PROJECT=$(firebase use)
echo "📋 Current project: $PROJECT"
echo ""

# Confirm deployment
read -p "Deploy to $PROJECT? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 0
fi

echo ""
echo "📦 Deploying Firestore rules..."
firebase deploy --only firestore:rules

echo ""
echo "📦 Deploying Firestore indexes..."
firebase deploy --only firestore:indexes

echo ""
echo "📦 Deploying Storage rules..."
firebase deploy --only storage

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Verify deployment:"
echo "   - Firestore rules: https://console.firebase.google.com/project/$PROJECT/firestore/rules"
echo "   - Storage rules: https://console.firebase.google.com/project/$PROJECT/storage/rules"
echo "   - Indexes: https://console.firebase.google.com/project/$PROJECT/firestore/indexes"

#!/bin/bash

# NyayaMitra Firebase Emulator Script
# Starts local Firebase emulators for development

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🔧 NyayaMitra Firebase Emulators"
echo "================================="
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Install it with:"
    echo "   npm install -g firebase-tools"
    exit 1
fi

echo "Starting Firebase emulators..."
echo ""
echo "Emulator ports:"
echo "  - Auth:      http://localhost:9099"
echo "  - Firestore: http://localhost:8080"
echo "  - Storage:   http://localhost:9199"
echo "  - UI:        http://localhost:4000"
echo ""
echo "Press Ctrl+C to stop"
echo ""

firebase emulators:start
